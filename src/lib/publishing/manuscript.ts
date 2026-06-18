import { readNote } from '../fs';
import type { BibEntry } from '../bibliography';
import { parseDocument } from './document';
import {
  type BlockNode,
  type DocumentModel,
  type DocumentMeta,
  type InlineNode,
  type ImageFigureNode,
  type TableNode,
  type MathBlockNode,
  type HeadingNode,
} from './ast';

/* ── Types ── */

export interface ManuscriptChapter {
  id: string;
  noteId: string;
  title: string;
  type: 'preface' | 'chapter' | 'appendix' | 'bibliography';
  number?: number;
}

export interface Manuscript {
  id: string;
  title: string;
  author?: string;
  date?: string;
  lang?: string;
  direction?: 'rtl' | 'ltr';
  chapters: ManuscriptChapter[];
}

export interface TocEntry {
  level: number;
  text: string;
  chapterId?: string;
  id?: string;
}

export interface ListEntry {
  id: string;
  number: number;
  caption: string;
  chapterId?: string;
  chapterTitle?: string;
}

export interface CompilationResult {
  manuscript: Manuscript;
  document: DocumentModel;
  toc: TocEntry[];
  figureList: ListEntry[];
  tableList: ListEntry[];
  equationList: ListEntry[];
  citations: string[];
}

/* ── Chapter compilation ── */

interface CompiledChapter {
  chapter: ManuscriptChapter;
  document: DocumentModel;
  figures: ImageFigureNode[];
  tables: TableNode[];
  equations: MathBlockNode[];
  headings: HeadingNode[];
  citations: string[];
}

async function compileChapter(chapter: ManuscriptChapter): Promise<CompiledChapter> {
  const markdown = await readNote(chapter.noteId);
  const doc = parseDocument(markdown);

  const figures: ImageFigureNode[] = [];
  const tables: TableNode[] = [];
  const equations: MathBlockNode[] = [];
  const headings: HeadingNode[] = [];
  const citations: string[] = [];

  function walkBlocks(blocks: BlockNode[]) {
    for (const block of blocks) {
      switch (block.type) {
        case 'imageFigure':
          figures.push(block);
          break;
        case 'table':
          tables.push(block);
          break;
        case 'mathBlock':
          equations.push(block);
          break;
        case 'heading':
          headings.push(block);
          break;
        case 'blockquote':
        case 'academicBlock':
        case 'matn':
        case 'sharh':
        case 'hashiyah':
          walkBlocks(block.children);
          break;
        case 'list':
          for (const item of block.items) {
            walkBlocks(item.children);
          }
          break;
        case 'listItem':
          walkBlocks(block.children);
          break;
      }
      // Collect citations from inline content
      collectCitations(block, citations);
    }
  }

  walkBlocks(doc.blocks);
  return { chapter, document: doc, figures, tables, equations, headings, citations };
}

function collectCitations(block: BlockNode, acc: string[]): void {
  function walkInline(nodes: InlineNode[]) {
    for (const node of nodes) {
      if (node.type === 'citation') {
        if (!acc.includes(node.key)) acc.push(node.key);
      }
      if ('children' in node && node.children) {
        walkInline(node.children as InlineNode[]);
      }
    }
  }

  if ('children' in block && block.children) {
    walkInline(block.children as InlineNode[]);
  }
  // Also check table cells
  if (block.type === 'table') {
    for (const row of block.header) {
      for (const cell of row.cells) {
        walkInline(cell.children);
      }
    }
    for (const row of block.body) {
      for (const cell of row.cells) {
        walkInline(cell.children);
      }
    }
  }
}

/* ── Front matter generators ── */

function generateTocBlock(toc: TocEntry[], lang: 'ar' | 'en' = 'ar'): BlockNode[] {
  if (toc.length === 0) return [];

  const blocks: BlockNode[] = [];

  // Heading
  const title = lang === 'ar' ? 'المحتويات' : 'Table of Contents';
  blocks.push({
    type: 'heading',
    level: 1,
    children: [{ type: 'text', value: title }],
  } as HeadingNode);

  // Flatten TOC: only top 3 levels for readability
  const items = toc.filter((e) => e.level <= 3);

  // Use a simple list with indentation represented by nesting
  for (const entry of items) {
    const indent = '\u00A0'.repeat((entry.level - 1) * 4);
    blocks.push({
      type: 'paragraph',
      children: [
        { type: 'text', value: indent + entry.text },
      ],
    });
  }

  return blocks;
}

function generateListBlock(
  entries: ListEntry[],
  heading: string,
  label: string,
): BlockNode[] {
  if (entries.length === 0) return [];

  const blocks: BlockNode[] = [];

  blocks.push({
    type: 'heading',
    level: 1,
    children: [{ type: 'text', value: heading }],
  } as HeadingNode);

  const items: BlockNode[] = entries.map((entry) => ({
    type: 'paragraph',
    children: [
      { type: 'text', value: `${label} ${entry.number}: ${entry.caption}` },
    ],
  }));

  // Flatten items into the block list
  blocks.push(...items);

  return blocks;
}

function generateTitlePage(manuscript: Manuscript): BlockNode[] {
  const blocks: BlockNode[] = [];

  blocks.push({
    type: 'heading',
    level: 1,
    children: [{ type: 'text', value: manuscript.title }],
  } as HeadingNode);

  if (manuscript.author) {
    blocks.push({
      type: 'paragraph',
      children: [{ type: 'text', value: manuscript.author }],
    });
  }

  if (manuscript.date) {
    blocks.push({
      type: 'paragraph',
      children: [{ type: 'text', value: manuscript.date }],
    });
  }

  blocks.push({ type: 'thematicBreak' });

  return blocks;
}

/* ── Main compiler ── */

/**
 * Compile a Manuscript into a unified DocumentModel AST.
 *
 * Steps:
 *  1. Read and parse every chapter's note
 *  2. Collect figures, tables, equations, headings, citations across all chapters
 *  3. Assign sequential numbers to figures, tables, equations
 *  4. Generate TOC, figure list, table list as AST blocks
 *  5. Merge into a single document: [title, toc, figure list, table list, chapters, bibliography]
 */
export async function compileManuscript(
  manuscript: Manuscript,
  allBibEntries: BibEntry[] = [],
): Promise<CompilationResult> {
  // ── Step 1: compile each chapter ──
  const compiled: CompiledChapter[] = [];
  for (const chapter of manuscript.chapters) {
    const cc = await compileChapter(chapter);
    compiled.push(cc);
  }

  // ── Step 2: collect metadata ──
  let globalFigNumber = 0;
  let globalTblNumber = 0;
  let globalEqNumber = 0;

  const figureList: ListEntry[] = [];
  const tableList: ListEntry[] = [];
  const equationList: ListEntry[] = [];
  const toc: TocEntry[] = [];
  const allCitations: string[] = [];

  for (const cc of compiled) {
    // Figures
    for (const fig of cc.figures) {
      globalFigNumber++;
      fig.number = globalFigNumber;
      fig.id = `fig-${globalFigNumber}`;
      figureList.push({
        id: fig.id,
        number: globalFigNumber,
        caption: fig.caption || fig.alt,
        chapterId: cc.chapter.id,
        chapterTitle: cc.chapter.title,
      });
    }

    // Tables
    for (const tbl of cc.tables) {
      globalTblNumber++;
      tbl.number = globalTblNumber;
      tbl.id = `tbl-${globalTblNumber}`;
      tableList.push({
        id: tbl.id,
        number: globalTblNumber,
        caption: tbl.caption || '',
        chapterId: cc.chapter.id,
        chapterTitle: cc.chapter.title,
      });
    }

    // Equations
    for (const eq of cc.equations) {
      globalEqNumber++;
      eq.number = globalEqNumber;
      eq.id = eq.label ? `eq:${eq.label}` : `eq-${globalEqNumber}`;
      equationList.push({
        id: eq.id,
        number: globalEqNumber,
        caption: eq.label || '',
        chapterId: cc.chapter.id,
        chapterTitle: cc.chapter.title,
      });
    }

    // TOC headings
    for (const h of cc.headings) {
      const text = h.children.map((c) => (c.type === 'text' ? c.value : '')).join('');
      toc.push({
        level: h.level,
        text,
        chapterId: cc.chapter.id,
        id: h.id,
      });
    }

    // Citations
    for (const key of cc.citations) {
      if (!allCitations.includes(key)) allCitations.push(key);
    }
  }

  // ── Step 3: determine language for labels ──
  const isArabic = manuscript.direction === 'rtl' || manuscript.lang === 'ar' ||
    /[\u0600-\u06FF]/.test(manuscript.title);

  // ── Step 4: build merged blocks ──
  const merged: BlockNode[] = [];

  // Title page
  merged.push(...generateTitlePage(manuscript));

  // Table of contents
  if (toc.length > 0) {
    merged.push(...generateTocBlock(toc, isArabic ? 'ar' : 'en'));
    merged.push({ type: 'thematicBreak' } as BlockNode);
  }

  // Figure list
  if (figureList.length > 0) {
    const heading = isArabic ? 'قائمة الأشكال' : 'List of Figures';
    const label = isArabic ? 'شكل' : 'Figure';
    merged.push(...generateListBlock(figureList, heading, label));
    merged.push({ type: 'thematicBreak' } as BlockNode);
  }

  // Table list
  if (tableList.length > 0) {
    const heading = isArabic ? 'قائمة الجداول' : 'List of Tables';
    const label = isArabic ? 'جدول' : 'Table';
    merged.push(...generateListBlock(tableList, heading, label));
    merged.push({ type: 'thematicBreak' } as BlockNode);
  }

  // ── Step 5: chapter blocks ──
  for (const cc of compiled) {
    if (cc.chapter.type === 'bibliography') {
      // Skip — handled below
      continue;
    }

    // Add a chapter separator before each chapter (except the first)
    if (cc !== compiled[0]) {
      merged.push({ type: 'thematicBreak' } as BlockNode);
    }

    // Add chapter heading if not already present in the note's own headings
    const hasH1 = cc.headings.some((h) => h.level === 1);
    if (!hasH1) {
      const prefix = cc.chapter.number !== undefined
        ? `${isArabic ? 'الفصل' : 'Chapter'} ${cc.chapter.number}: `
        : '';
      merged.push({
        type: 'heading',
        level: 1,
        children: [{ type: 'text', value: `${prefix}${cc.chapter.title}` }],
      } as HeadingNode);
    }

    merged.push(...cc.document.blocks);
  }

  // ── Step 6: bibliography ──
  if (allCitations.length > 0) {
    merged.push({ type: 'thematicBreak' } as BlockNode);
    const bibHeading = isArabic ? 'المراجع' : 'Bibliography';
    merged.push({
      type: 'heading',
      level: 1,
      children: [{ type: 'text', value: bibHeading }],
    } as HeadingNode);

    const entryMap = new Map(allBibEntries.map((e) => [e.key, e]));
    let bibIdx = 0;
    for (const key of allCitations) {
      const entry = entryMap.get(key);
      bibIdx++;
      if (entry) {
        const text = formatBibEntry(entry, bibIdx, isArabic);
        merged.push({
          type: 'paragraph',
          children: [{ type: 'text', value: text }],
        });
      } else {
        merged.push({
          type: 'paragraph',
          children: [{ type: 'text', value: `[${bibIdx}] ${key} (${isArabic ? 'غير موجود' : 'missing'})` }],
        });
      }
    }
  }

  // Also append any explicit bibliography chapter contents
  for (const cc of compiled) {
    if (cc.chapter.type === 'bibliography') {
      merged.push({ type: 'thematicBreak' } as BlockNode);
      merged.push(...cc.document.blocks);
    }
  }

  // ── Step 7: build result ──
  const meta: DocumentMeta = {
    title: manuscript.title,
    author: manuscript.author,
    date: manuscript.date,
    lang: manuscript.lang,
    direction: manuscript.direction,
  };

  const document: DocumentModel = {
    meta,
    blocks: merged,
    bibEntries: allBibEntries,
    errors: [],
  };

  return {
    manuscript,
    document,
    toc,
    figureList,
    tableList,
    equationList,
    citations: allCitations,
  };
}

/* ── Helpers ── */

function formatBibEntry(entry: BibEntry, index: number, arabic: boolean): string {
  const clean = (s: string) => s.replace(/[{}]/g, '').trim();
  const author = clean(entry.fields.author || '');
  const title = clean(entry.fields.title || '');
  const year = clean(entry.fields.year || (arabic ? 'د.ت.' : 'n.d.'));
  const journal = clean(entry.fields.journal || '');
  const publisher = clean(entry.fields.publisher || '');
  const volume = clean(entry.fields.volume || '');
  const number = clean(entry.fields.number || '');

  let text = `[${index}] ${author}`;
  if (year) text += ` (${year})`;
  text += arabic ? `. «${title}»` : `. ${title}`;

  if (entry.type === 'article') {
    if (journal) text += arabic ? `. مجلة: ${journal}` : `. ${journal}`;
    if (volume) text += `, ${volume}`;
    if (number) text += ` (${number})`;
    text += '.';
  } else if (entry.type === 'book') {
    if (publisher) text += arabic ? `. الناشر: ${publisher}` : `. ${publisher}`;
    text += '.';
  } else {
    text += '.';
  }

  return text;
}
