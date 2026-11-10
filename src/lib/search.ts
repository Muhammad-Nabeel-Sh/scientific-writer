import type { TreeNode } from '$lib/stores';
import { readNote } from '$lib/fs';

/* ── Arabic text normalization ── */

const DIACRITICS = /[\u064B-\u065F\u0670\u0640\u06D6-\u06DC\u06DE\u06E9]/g;

function stripDiacritics(s: string): string {
  return s.replace(DIACRITICS, '');
}

/** Normalize Arabic for search: fold presentation forms, strip diacritics, unify alif/ya/ta/waw */
export function normalizeArabic(s: string): string {
  return stripDiacritics(s.normalize('NFKC'))
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Full normalization (Arabic + English lowercasing) */
function normalize(s: string): string {
  return normalizeArabic(s.toLocaleLowerCase('en'));
}

/* ── Index data structures ── */

export interface NoteIndexEntry {
  id: string;
  name: string;
  nameNorm: string;
  content: string;
  contentNorm: string;
  headings: { text: string; textNorm: string; level: number; lineIndex: number }[];
  citations: { key: string }[];
  figures: { alt: string; altNorm: string; src: string }[];
  equations: { tex: string; texNorm: string; label?: string }[];
}

export interface SearchIndex {
  notes: NoteIndexEntry[];
}

/* ── Match & result types ── */

export type MatchType = 'title' | 'heading' | 'content' | 'citation' | 'figure' | 'equation';

export interface SearchMatch {
  type: MatchType;
  snippet: string;
  /** Character ranges in the snippet to highlight [start, end][] */
  ranges: [number, number][];
  /** Approximate line index in the original note (for navigation) */
  lineIndex?: number;
}

export interface SearchResult {
  noteId: string;
  noteName: string;
  matches: SearchMatch[];
  score: number;
}

/* ── Heading / citation / figure / equation extractors ── */

function extractHeadings(content: string): { text: string; textNorm: string; level: number; lineIndex: number }[] {
  const lines = content.split('\n');
  const result: ReturnType<typeof extractHeadings> = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith('```')) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (m) {
      const text = m[2].trim();
      result.push({ text, textNorm: normalize(text), level: m[1].length, lineIndex: i });
    }
  }
  return result;
}

function extractCitations(content: string): { key: string }[] {
  const keys = new Set<string>();
  const re = /\[@([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    for (const part of m[1].split(';')) {
      const k = part.trim();
      if (k) keys.add(k);
    }
  }
  return [...keys].map(key => ({ key }));
}

function extractFigures(content: string): { alt: string; altNorm: string; src: string }[] {
  const result: ReturnType<typeof extractFigures> = [];
  const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const alt = m[1].trim();
    result.push({ alt, altNorm: normalize(alt), src: m[2] });
  }
  return result;
}

function extractEquations(content: string): { tex: string; texNorm: string; label?: string }[] {
  const result: ReturnType<typeof extractEquations> = [];
  const re = /\$\$([\s\S]*?)\$\$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const tex = m[1].trim();
    const labelM = tex.match(/\{#eq:([^}]+)\}/);
    result.push({ tex, texNorm: normalize(tex), label: labelM ? labelM[1] : undefined });
  }
  return result;
}

/* ── Index builder ── */

function collectNoteIds(nodes: TreeNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.type === 'note') ids.push(node.id);
    if (node.children) ids.push(...collectNoteIds(node.children));
  }
  return ids;
}

function indexNote(node: TreeNode, content: string): NoteIndexEntry {
  return {
    id: node.id,
    name: node.name,
    nameNorm: normalize(node.name),
    content,
    contentNorm: normalize(content),
    headings: extractHeadings(content),
    citations: extractCitations(content),
    figures: extractFigures(content),
    equations: extractEquations(content),
  };
}

/**
 * Build a search index from the hierarchy tree.
 * Reads every note from disk.
 */
export async function buildIndex(hierarchy: TreeNode[]): Promise<SearchIndex> {
  const ids = collectNoteIds(hierarchy);
  const notes: NoteIndexEntry[] = [];
  for (const id of ids) {
    try {
      const node = findNode(hierarchy, id);
      if (!node) continue;
      const content = await readNote(id);
      notes.push(indexNote(node, content));
    } catch {
      // skip unreadable notes
    }
  }
  return { notes };
}

function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

/* ── Highlight range finder ── */

/**
 * Given an original text and a normalized query, find all [start, end] positions
 * in the original text where the query matches (accounting for normalization).
 */
function findHighlightRanges(orig: string, normQuery: string): [number, number][] {
  const norm = normalize(orig);
  if (!normQuery) return [];
  const ranges: [number, number][] = [];
  let searchPos = 0;

  while (true) {
    const normPos = norm.indexOf(normQuery, searchPos);
    if (normPos === -1) break;

    // Map normPos → origPos by counting normalized characters
    let origPos = 0;
    let normIdx = 0;
    while (normIdx < normPos && origPos < orig.length) {
      if (normalize(orig[origPos])) normIdx++;
      origPos++;
    }

    // Map end position
    let origEnd = origPos;
    let matchLen = 0;
    while (matchLen < normQuery.length && origEnd < orig.length) {
      const c = orig[origEnd];
      if (normalize(c)) matchLen++;
      else if (c === '\n') break;
      origEnd++;
    }

    ranges.push([origPos, origEnd]);
    searchPos = normPos + normQuery.length;
  }

  return ranges;
}

/* ── Snippet extraction ── */

function extractSnippet(orig: string, norm: string, normQuery: string, normPos: number): string {
  const ctxLen = 60;

  // Estimate origPos from normPos
  let origPos = 0;
  let normIdx = 0;
  while (normIdx < normPos && origPos < orig.length) {
    if (normalize(orig[origPos])) normIdx++;
    origPos++;
  }

  const snippetStart = Math.max(0, origPos - ctxLen);
  const snippetEnd = Math.min(orig.length, origPos + normQuery.length + ctxLen);

  let snippet = orig.slice(snippetStart, snippetEnd);
  if (snippetStart > 0) snippet = '…' + snippet;
  if (snippetEnd < orig.length) snippet = snippet + '…';

  return snippet;
}

/* ── Query executor ── */

/**
 * Search the index for a query string.
 * Returns results grouped by note, sorted by relevance.
 */
export function searchIndex(index: SearchIndex, query: string): SearchResult[] {
  const q = normalize(query);
  if (!q || q.length < 1) return [];

  const results: SearchResult[] = [];

  for (const note of index.notes) {
    const matches: SearchMatch[] = [];

    // ── title ──
    if (note.nameNorm.includes(q)) {
      const ranges = findHighlightRanges(note.name, q);
      matches.push({ type: 'title', snippet: note.name, ranges });
    }

    // ── headings ──
    for (const h of note.headings) {
      if (h.textNorm.includes(q)) {
        const ranges = findHighlightRanges(h.text, q);
        matches.push({ type: 'heading', snippet: h.text, ranges, lineIndex: h.lineIndex });
      }
    }

    // ── content (by line) ──
    const contentLines = note.content.split('\n');
    const normLines = note.contentNorm.split('\n');
    for (let i = 0; i < contentLines.length; i++) {
      if (normLines[i] && normLines[i].includes(q)) {
        const line = contentLines[i].trim();
        if (!line) continue;
        const ranges = findHighlightRanges(line, q);
        matches.push({ type: 'content', snippet: line, ranges, lineIndex: i });
      }
    }

    // ── citations ──
    for (const c of note.citations) {
      if (c.key.toLocaleLowerCase('en').includes(q) || normalizeArabic(c.key).includes(q)) {
        const text = `@${c.key}`;
        const normText = normalize(text);
        const ranges = findHighlightRanges(text, q);
        matches.push({ type: 'citation', snippet: text, ranges });
      }
    }

    // ── figures ──
    for (const f of note.figures) {
      if (f.altNorm.includes(q)) {
        const ranges = findHighlightRanges(f.alt, q);
        matches.push({ type: 'figure', snippet: f.alt, ranges });
      }
    }

    // ── equations ──
    for (const e of note.equations) {
      if (e.texNorm.includes(q)) {
        const ranges = findHighlightRanges(e.tex, q);
        const snippet = e.tex.length > 100 ? e.tex.slice(0, 100) + '…' : e.tex;
        const rs = findHighlightRanges(e.tex, q);
        matches.push({ type: 'equation', snippet, ranges: rs });
      }
    }

    if (matches.length > 0) {
      // score: unique match types weighted + occurrence count bonus
      const typeCount = new Set(matches.map(m => m.type)).size;
      const score = typeCount * 3 + matches.length;
      results.push({ noteId: note.id, noteName: note.name, matches, score });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/* ── Vector search extension point ── */

export interface VectorStore {
  search(vector: number[], topK: number): Promise<SearchResult[]>;
}

/**
 * Optional vector search provider.
 * Set this to enable semantic/vector search alongside keyword search.
 * @example
 * ```ts
 * import { vectorSearch } from './search';
 * vectorSearch.provider = myVectorStore;
 * ```
 */
export const vectorSearch: { provider?: VectorStore } = {};

/**
 * Perform hybrid search (keyword + vector) if a vector provider is registered.
 * Falls back to pure keyword search otherwise.
 */
export async function hybridSearch(
  index: SearchIndex,
  query: string,
  vector?: number[],
): Promise<SearchResult[]> {
  const keywordResults = searchIndex(index, query);

  if (vector && vectorSearch.provider) {
    const vectorResults = await vectorSearch.provider.search(vector, 20);
    // Merge: interleave results, deduplicate by noteId
    const seen = new Set<string>();
    const merged: SearchResult[] = [];

    for (const r of [...keywordResults, ...vectorResults]) {
      if (!seen.has(r.noteId)) {
        seen.add(r.noteId);
        merged.push(r);
      }
    }
    return merged;
  }

  return keywordResults;
}
