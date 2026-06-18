import MarkdownIt from 'markdown-it';
import katex from '@traptitech/markdown-it-katex';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import 'katex/dist/katex.min.css';
import type { BibEntry } from './bibliography';
import { replaceCitations, generateBibliographyHtml } from './bibliography';
import { academicBlocksPlugin, resetBlockState, resolveBlockRefs } from './blocks';

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const arabicRe = /[\u0600-\u06FF]/;

function renderPoem(str: string): string {
  const lines = str.trim().split('\n');
  const verses = lines
    .filter(l => l.trim())
    .map(l => {
      const parts = l.split('||');
      if (parts.length >= 2) {
        return { sadr: parts[0].trim(), ajuz: parts[1].trim() };
      }
      return { sadr: l.trim(), ajuz: '' };
    });
  if (verses.length === 0) return '';

  const inner = verses.map(v => {
    if (!v.ajuz) {
      return `<div class="poem-verse single"><span class="verse-sadr">${md.utils.escapeHtml(v.sadr)}</span></div>`;
    }
    return `<div class="poem-verse"><span class="verse-sadr">${md.utils.escapeHtml(v.sadr)}</span><div class="verse-gap"></div><span class="verse-ajuz">${md.utils.escapeHtml(v.ajuz)}</span></div>`;
  }).join('\n');

  return `<div class="arabic-poem" dir="rtl">\n${inner}\n</div>`;
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
  highlight(str: string, lang: string): string {
    if (lang === 'poetry') {
      return renderPoem(str);
    }
    if (lang && hljs.getLanguage(lang)) {
      try {
        const hl = hljs.highlight(str, { language: lang, ignoreIllegals: true });
        return `<pre dir="auto"><code class="hljs language-${lang}">${hl.value}</code></pre>`;
      } catch { /* fall through */ }
    }
    return `<pre dir="auto"><code class="hljs">${md.utils.escapeHtml(str)}</code></pre>`;
  },
}).use(katex, {
  throwOnError: false,
  displayMode: true,
}).use(academicBlocksPlugin);

export interface EquationInfo {
  id: string;
  number: number;
  label?: string;
  latex: string;
}

export function parseEquationsFromText(text: string): EquationInfo[] {
  const result: EquationInfo[] = [];
  let num = 0;
  const parts = text.split(/^(?:```[\s\S]*?```)$/gm);
  for (let pi = 0; pi < parts.length; pi += 2) {
    parts[pi].replace(/\$\$[\s\S]*?\$\$(?:\s*\{#eq:(\w+)\}\s*)?/g, (match) => {
      num++;
      const latexMatch = match.match(/\$\$([\s\S]*?)\$\$/);
      const latex = latexMatch ? latexMatch[1].trim() : '';
      const labelMatch = match.match(/\{#eq:(\w+)\}/);
      if (labelMatch) {
        result.push({ id: `eq:${labelMatch[1]}`, number: num, label: labelMatch[1], latex });
      } else {
        result.push({ id: `eq-${num}`, number: num, latex });
      }
      return match;
    });
  }
  return result;
}

let figCounter = 0;
let figUsedIds = new Set<string>();
let equationInfos: EquationInfo[] = [];

function resetFigureState() {
  figCounter = 0;
  figUsedIds = new Set<string>();
  equationInfos = [];
}

export function getLastEquationResult(): EquationInfo[] {
  return equationInfos;
}

function genFigureId(src: string): string {
  let base = src.replace(/^.*[/\\]/, '').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-') || 'figure';
  let id = `fig-${base}`;
  if (figUsedIds.has(id)) {
    let i = 2;
    while (figUsedIds.has(`fig-${base}-${i}`)) i++;
    id = `fig-${base}-${i}`;
  }
  figUsedIds.add(id);
  return id;
}

export function parseFigures(markdown: string): FigureInfo[] {
  const figures: FigureInfo[] = [];
  const used = new Set<string>();
  const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  let num = 0;
  while ((m = re.exec(markdown)) !== null) {
    num++;
    const src = m[2];
    const caption = m[1].trim();
    let base = src.replace(/^.*[/\\]/, '').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-') || 'figure';
    let id = `fig-${base}`;
    if (used.has(id)) {
      let i = 2;
      while (used.has(`fig-${base}-${i}`)) i++;
      id = `fig-${base}-${i}`;
    }
    used.add(id);
    figures.push({ id, number: num, src, caption });
  }
  return figures;
}

// Override image renderer — every image becomes a centered figure with auto-numbered caption
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const src = token.attrGet('src') || '';
  const alt = token.content || '';
  const title = token.attrGet('title');

  figCounter++;
  const hasArabic = /[\u0600-\u06FF]/.test(alt);
  const label = hasArabic ? 'الشكل' : 'Figure';
  const id = genFigureId(src);
  const titleAttr = title ? ` title="${md.utils.escapeHtml(title)}"` : '';
  const captionText = alt ? `: ${md.utils.escapeHtml(alt)}` : '';

  return `<figure class="figure" id="${id}">
    <img src="${md.utils.escapeHtml(src)}" alt="${md.utils.escapeHtml(alt)}" loading="lazy"${titleAttr} />
    <figcaption dir="auto">${label} ${figCounter}${captionText}</figcaption>
  </figure>`;
};

function convertArabicDigits(text: string): string {
  if (!arabicRe.test(text)) return text;
  // Replace digits outside inline code, math, URLs, citations, equation labels, and equation references
  return text.split(/(`[^`]*`|\$\$[^$]*\$\$|\$[^$]*\$|!\[[^\]]*\]\([^)]*\)|\[[^\]]*\]\([^)]*\)|\[\@[^\]]*\]|\[ref:[^\]]*\]|\{#eq:[^}]*\})/g).map((part, i) => {
    if (i % 2 === 0) {
      return part.replace(/[0-9]/g, d => ARABIC_INDIC[+d]);
    }
    return part;
  }).join('');
}

export interface FigureInfo {
  id: string;
  number: number;
  src: string;
  caption: string;
}

export interface TableInfo {
  id: string;
  number: number;
  caption: string;
}

export function parseTables(markdown: string): TableInfo[] {
  const tables: TableInfo[] = [];
  const lines = markdown.split('\n');
  let num = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith('|')) {
      num++;
      tables.push({
        id: `tbl-${num}`,
        number: num,
        caption: '',
      });
      continue;
    }
    const capMatch = lines[i].match(/^(?:Table|جدول):\s*(.*)/);
    if (capMatch) {
      let caption = capMatch[1].trim();
      let j = i + 1;
      while (j < lines.length && !lines[j].trimStart().startsWith('|')) {
        if (lines[j].trim()) {
          if (caption) caption += ' ';
          caption += lines[j].trim();
        }
        j++;
      }
      if (j < lines.length && lines[j].trimStart().startsWith('|')) {
        num++;
        tables.push({
          id: `tbl-${num}`,
          number: num,
          caption,
        });
        i = j;
      }
    }
  }
  return tables;
}

export interface OutlineItem {
  id: string;
  level: number;
  text: string;
  lineIndex: number;
  charOffset: number;
}

export function parseOutline(markdown: string): OutlineItem[] {
  const lines = markdown.split('\n');
  const items: OutlineItem[] = [];
  let charOffset = 0;
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      charOffset += line.length + 1;
      continue;
    }
    if (!inFence) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        items.push({
          id: `h-${i}`,
          level: match[1].length,
          text: match[2].trim(),
          lineIndex: i,
          charOffset,
        });
      }
    }
    charOffset += line.length + 1;
  }
  return items;
}

let lastUsedKeys: string[] = [];
let lastMissingKeys: string[] = [];

export function getLastCitationResult(): { usedKeys: string[]; missingKeys: string[] } {
  return { usedKeys: lastUsedKeys, missingKeys: lastMissingKeys };
}

export function renderMarkdown(text: string, bibEntries?: BibEntry[]): string {
  try {
    resetFigureState();
    lastUsedKeys = [];
    lastMissingKeys = [];

    // Pre-process: convert digits and turn soft returns into hard returns
    const lines = text.split('\n');
    let inFence = false;
    const resultLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isFenceLine = line.trimStart().startsWith('```');
      if (isFenceLine) {
        inFence = !inFence;
      }
      if (!inFence && !isFenceLine && !/^ {4}/.test(line)) {
        resultLines.push(convertArabicDigits(line));
      } else {
        resultLines.push(line);
      }
      if (!inFence && !isFenceLine && !line.trimStart().startsWith('|')) {
        resultLines.push(''); // blank line → hard return (new paragraph)
      }
    }

    // Extract table captions (remove caption lines, store text)
    const captionMap = new Map<number, string>();
    const cleanLines: string[] = [];
    let rawTblIdx = 0;
    for (let i = 0; i < resultLines.length; i++) {
      const capMatch = resultLines[i].match(/^(?:Table|جدول):\s*(.*)/);
      if (capMatch) {
        let caption = capMatch[1].trim();
        let j = i + 1;
        while (j < resultLines.length && !resultLines[j].trimStart().startsWith('|')) {
          if (resultLines[j].trim()) {
            if (caption) caption += ' ';
            caption += resultLines[j].trim();
          }
          j++;
        }
        if (j < resultLines.length && resultLines[j].trimStart().startsWith('|')) {
          captionMap.set(rawTblIdx, caption);
          i = j - 1; // will be incremented to the table-start line
          continue;
        }
      }
      if (resultLines[i].trimStart().startsWith('|')) rawTblIdx++;
      cleanLines.push(resultLines[i]);
    }
    let processed = cleanLines.join('\n');

    // Equation parsing: extract $$...$$ blocks outside code fences, strip {#eq:label}
    let eqNum = 0;
    equationInfos = [];
    const eqParts = processed.split(/^(?:```[\s\S]*?```)$/gm);
    for (let pi = 0; pi < eqParts.length; pi += 2) {
      eqParts[pi] = eqParts[pi].replace(/\$\$[\s\S]*?\$\$(?:\s*\{#eq:(\w+)\}\s*)?/g, (match) => {
        eqNum++;
        const latexMatch = match.match(/\$\$([\s\S]*?)\$\$/);
        const latex = latexMatch ? latexMatch[1].trim() : '';
        const labelMatch = match.match(/\{#eq:(\w+)\}/);
        if (labelMatch) {
          const label = labelMatch[1];
          equationInfos.push({ id: `eq:${label}`, number: eqNum, label, latex });
          return match.replace(/\s*\{#eq:\w+\}\s*$/, '');
        }
        equationInfos.push({ id: `eq-${eqNum}`, number: eqNum, latex });
        return match;
      });
    }
    processed = eqParts.join('');

    // Citation replacement
    if (bibEntries && bibEntries.length > 0) {
      const result = replaceCitations(processed, bibEntries);
      processed = result.text;
      lastUsedKeys = result.usedKeys;
      lastMissingKeys = result.missingKeys;
    }

    resetBlockState();
    const html = md.render(processed);
    let htmlOut = html.replace(
      /<(p|h[1-6]|blockquote|pre|th|td|li)\b/gi,
      '<$1 dir="auto"',
    );
    htmlOut = htmlOut.replace(
      /<(ul|ol)\b[^>]*>/gi,
      (tag, _p1, offset: number) => {
        const closeLi = htmlOut.indexOf('</li>', offset);
        const content = htmlOut.slice(offset, closeLi);
        const isRtl = /[\u0600-\u06FF]/.test(content);
        return tag.replace(/(ul|ol)\b/, `$1 dir="${isRtl ? 'rtl' : 'ltr'}"`);
      },
    );
    htmlOut = htmlOut.replace(/<table\b[^>]*>/gi, (match, offset: number) => {
      const endIdx = htmlOut.indexOf('</table>', offset + match.length);
      const content = endIdx > -1 ? htmlOut.slice(offset + match.length, endIdx) : '';
      const isRtl = /[\u0600-\u06FF]/.test(content);
      return `<table dir="${isRtl ? 'rtl' : 'ltr'}"`;
    });

    // Inject table captions — every table gets an auto-numbered caption
    let tblIdx = 0;
    htmlOut = htmlOut.replace(/<table\b[^>]*>[\s\S]*?<\/table>/g, (match) => {
      const caption = captionMap.get(tblIdx) || '';
      const num = tblIdx + 1;
      tblIdx++;
      const hasArabic = /[\u0600-\u06FF]/.test(match);
      const label = hasArabic ? 'جدول' : 'Table';
      const id = `tbl-${num}`;
      const captionSuffix = caption ? `: ${md.utils.escapeHtml(caption)}` : '';
      return `<figure class="table-figure" id="${id}">
        <figcaption dir="auto">${label} ${num}${captionSuffix}</figcaption>
        ${match}
      </figure>`;
    });

    // Wrap displayed equations with auto-numbered figures
    let eqIdx = 0;
    htmlOut = htmlOut.replace(
      /<p[^>]*class="katex-block[^"]*"[^>]*>[\s\S]*?<\/p>/g,
      (match) => {
        const eq = equationInfos[eqIdx++];
        if (!eq) return match;
        return `<figure class="equation-figure" id="${eq.id}">${match}<figcaption class="eq-number">(${eq.number})</figcaption></figure>`;
      },
    );

    // Replace [ref:eq:label] / [ref:eq:N] with anchor links
    if (equationInfos.length > 0) {
      const refMap = new Map<string, EquationInfo>();
      for (const eq of equationInfos) {
        if (eq.label) refMap.set(eq.label, eq);
        refMap.set(String(eq.number), eq);
      }
      htmlOut = htmlOut.replace(/\[ref:eq:([^\]]+)\]/g, (_match, ref) => {
        const eq = refMap.get(ref);
        if (eq) {
          return `<a href="#${eq.id}" class="eq-ref">(${eq.number})</a>`;
        }
        return `<span class="eq-ref-unresolved">[ref:eq:${ref}]</span>`;
      });
    }

    htmlOut = resolveBlockRefs(htmlOut);

    // Append bibliography
    if (bibEntries && bibEntries.length > 0 && (lastUsedKeys.length > 0 || lastMissingKeys.length > 0)) {
      htmlOut += generateBibliographyHtml(lastUsedKeys, bibEntries, lastMissingKeys);
    }

    return htmlOut;
  } catch {
    return '<p style="color:#ff6b6b">خطأ في تحليل المعادلات الرياضية</p>';
  }
}
