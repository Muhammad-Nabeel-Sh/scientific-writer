/**
 * DocumentModel → LaTeX.
 *
 * Arabic, or Arabic math symbols anywhere → XeLaTeX (fontspec, polyglossia,
 * unicode-math with Katib Math). Pure-Latin documents → pdfLaTeX.
 * Registry symbols used by the document are defined in the preamble
 * (src/lib/math/to-latex.ts). Passages in the other language are switched with
 * polyglossia (\textenglish / \textarabic and the english / Arabic
 * environments) so bidi ordering and fonts are right.
 */
import type { Exporter, ExportResult } from './exporter';
import type { DocumentModel, BlockNode, InlineNode, TableRowNode, MathBlockNode } from './ast';
import type { BibEntry } from '../bibliography';
import { blockRefText } from '../blocks';
import { getSymbols } from '../math';
import { arabicInMathForLatex, latexSymbolSetup } from '../math/to-latex';
import { bodyWithoutTitle } from './title';

const LATEX_ESCAPES: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  '&': '\\&',
  '%': '\\%',
  '$': '\\$',
  '#': '\\#',
  '_': '\\_',
  '^': '\\textasciicircum{}',
  '~': '\\textasciitilde{}',
};

export function escapeLatex(s: string): string {
  // One pass: replacing \\ first would corrupt the braces in its replacement.
  return s.replace(/[\\{}&%$#_^~]/g, (m) => LATEX_ESCAPES[m]);
}

/** Safe LaTeX label key: keep Unicode letters/numbers, `: . _ -`, replace the rest. */
export function latexLabel(s: string): string {
  return s.replace(/[^\p{L}\p{N}:._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'eq';
}

export type LatexNumerals = 'mashriq' | 'maghrib';

export interface LatexPreambleOptions {
  rtl: boolean;
  numerals: LatexNumerals;
  arabicFont?: string;
  title?: string;
  author?: string;
  date?: string;
  /** XeLaTeX is required for Arabic text or Arabic math symbols. Default: `rtl`. */
  xelatex?: boolean;
  /** Extra packages (e.g. graphicx for mirrored symbols); deduplicated. */
  packages?: string[];
  /** Registry symbol definitions (to-latex.ts). */
  definitions?: string;
}

/** Map the app's digit style to polyglossia's Arabic numerals option. */
export function numeralsFor(digitStyle: unknown, rtl: boolean): LatexNumerals {
  if (digitStyle === 'western') return 'maghrib';
  if (digitStyle === 'eastern') return 'mashriq';
  return rtl ? 'mashriq' : 'maghrib';
}

function safeFontName(font: string | undefined): string {
  const cleaned = (font || 'Amiri').replace(/[^A-Za-z0-9 ._-]/g, '').trim();
  return cleaned || 'Amiri';
}

const BASE_PACKAGES = ['graphicx', 'listings', 'soul', 'caption', 'geometry'];

function titleBlock(o: LatexPreambleOptions): string {
  if (!o.title && !o.author) return '';
  return `\\title{${escapeLatex(o.title || '')}}\n\\author{${escapeLatex(o.author || '')}}\n\\date{${escapeLatex(o.date || '')}}\n\\maketitle\n`;
}

export function buildLatexPreamble(o: LatexPreambleOptions): string {
  const xelatex = o.xelatex ?? o.rtl;
  const arabicFont = safeFontName(o.arabicFont);
  const packages = [...new Set([...BASE_PACKAGES, ...(o.packages ?? [])])];
  const pkgLines = packages.map((p) => `\\usepackage{${p}}`).join('\n');
  const definitions = o.definitions ? `\n${o.definitions}\n` : '';

  if (xelatex) {
    const main = o.rtl ? 'arabic' : 'english';
    const other = o.rtl ? 'english' : 'arabic';
    const arabicOpts = `numerals=${o.numerals}`;
    const langLines = o.rtl
      ? `\\setmainlanguage[${arabicOpts}]{arabic}\n\\setotherlanguage{english}`
      : `\\setmainlanguage{english}\n\\setotherlanguage[${arabicOpts}]{arabic}`;
    // In Arabic-Indic digits zero (٠) is a dot, so "1.1" printed as ١.١ reads as ١٠١.
    // Separate section numbers with a hyphen instead (verified with Tectonic).
    const sectionSep =
      o.rtl && o.numerals === 'mashriq'
        ? `\n% Arabic-Indic zero (٠) looks like a period: use "-" between section numbers\n` +
          `\\renewcommand{\\thesubsection}{\\thesection-\\arabic{subsection}}\n` +
          `\\renewcommand{\\thesubsubsection}{\\thesubsection-\\arabic{subsubsection}}`
        : '';
    return `% Compile with: xelatex <file>.tex (run twice for references)
% Fonts: "${arabicFont}" must be installed; put KatibMath-Regular.otf
% (fonts-src/katib-math/dist/) next to this file.
\\documentclass[12pt,a4paper]{article}
\\usepackage{amsmath,mathtools}
${pkgLines}
\\geometry{right=2.5cm,left=2.5cm,top=2.5cm,bottom=2.5cm}
\\lstset{basicstyle=\\ttfamily\\small,showstringspaces=false,breaklines=true,columns=fullflexible}
\\usepackage{fontspec}
\\usepackage{unicode-math}
\\setmainfont{${arabicFont}}
\\newfontfamily\\arabicfont[Script=Arabic,Scale=1.2]{${arabicFont}}
\\setmathfont[Path=./]{KatibMath-Regular.otf}
\\usepackage{hyperref}
\\usepackage{polyglossia}
${langLines}
% main language: ${main}; other: ${other}${sectionSep}
${definitions}
\\begin{document}
${titleBlock(o)}`;
  }

  return `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amssymb,mathtools}
${pkgLines}
\\geometry{right=2.5cm,left=2.5cm,top=2.5cm,bottom=2.5cm}
\\lstset{basicstyle=\\ttfamily\\small,showstringspaces=false,breaklines=true,columns=fullflexible}
\\usepackage{hyperref}
${definitions}
\\begin{document}
${titleBlock(o)}`;
}

/* ── language runs ── */

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN = /[A-Za-z\u00C0-\u024F]/;
/** A Latin passage: starts and ends with a Latin letter/digit; may contain spaces and ASCII punctuation. */
const LATIN_RUN = /[A-Za-z\u00C0-\u024F](?:[A-Za-z\u00C0-\u024F0-9 .,:;!?'"()\-/+*=&%]*[A-Za-z\u00C0-\u024F0-9)])?/g;
const ARABIC_RUN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF](?:[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF0-9\u0660-\u0669 .،؛؟:!()«»\-]*[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0660-\u0669)»])?/g;

interface Ctx {
  rtl: boolean;
  /** Inline language wrapping is off inside a block already switched to the other language. */
  wrapRuns: boolean;
  footnotes: Map<string, BlockNode[]>;
  eqLabels: Map<string, string>;
  /** 1 when the only H1 became the document title: H2 → \section, H3 → \subsection … */
  headingShift: number;
}

/** Escape text, wrapping passages in the document's other language. */
function textRuns(raw: string, ctx: Ctx): string {
  if (!ctx.wrapRuns) return escapeLatex(raw);
  const re = ctx.rtl ? LATIN_RUN : ARABIC_RUN;
  const cmd = ctx.rtl ? '\\textenglish' : '\\textarabic';
  let out = '';
  let last = 0;
  for (const m of raw.matchAll(re)) {
    out += escapeLatex(raw.slice(last, m.index));
    out += `${cmd}{${escapeLatex(m[0])}}`;
    last = (m.index ?? 0) + m[0].length;
  }
  return out + escapeLatex(raw.slice(last));
}

function plain(nodes: InlineNode[]): string {
  return nodes.map((n) => ('value' in n ? n.value : 'children' in n ? plain(n.children) : '')).join('');
}

/** The other-language environment a whole paragraph should be wrapped in, if any. */
function blockLanguageEnv(text: string, rtl: boolean): string | null {
  if (rtl && LATIN.test(text) && !ARABIC.test(text)) return 'english';
  if (!rtl && ARABIC.test(text) && !LATIN.test(text)) return 'Arabic';
  return null;
}

/* ── inline ── */

function escapeUrl(url: string): string {
  return url.replace(/[%#\\]/g, (m) => `\\${m}`);
}

function renderInline(nodes: InlineNode[], ctx: Ctx): string {
  let out = '';
  for (const n of nodes) {
    switch (n.type) {
      case 'text': out += textRuns(n.value, ctx); break;
      case 'strong': out += `\\textbf{${renderInline(n.children, ctx)}}`; break;
      case 'emphasis': out += `\\emph{${renderInline(n.children, ctx)}}`; break;
      case 'strikethrough': out += `\\sout{${renderInline(n.children, ctx)}}`; break;
      // Language first, then font: \texttt inside Arabic makes polyglossia demand
      // Arabic support from the monospace font (verified with Tectonic).
      case 'inlineCode': out += ctx.rtl ? `\\textenglish{\\texttt{${escapeLatex(n.value)}}}` : `\\texttt{${escapeLatex(n.value)}}`; break;
      case 'link': out += `\\href{${escapeUrl(n.url)}}{${renderInline(n.children, ctx)}}`; break;
      case 'inlineMath': out += `$${arabicInMathForLatex(n.value)}$`; break;
      case 'footnoteRef': {
        const def = ctx.footnotes.get(n.id);
        out += def ? `\\footnote{${renderBlocks(def, ctx).trim()}}` : '';
        break;
      }
      case 'citation': out += `\\cite{${n.key}}`; break;
      case 'equationRef': out += `\\eqref{eq:${latexLabel(ctx.eqLabels.get(n.ref) ?? n.ref)}}`; break;
      case 'blockRef': out += `(${escapeLatex(n.display || n.ref)})`; break;
      case 'wikiLink': out += textRuns(n.display || n.target, ctx); break;
      case 'lineBreak': out += `\\\\\n`; break;
      case 'inlineImage': out += `\\includegraphics[height=1em]{${n.src}}`; break;
    }
  }
  return out;
}

/* ── blocks ── */

const LISTINGS_LANGUAGES: Record<string, string> = {
  python: 'Python', py: 'Python', java: 'Java', c: 'C', cpp: 'C++', 'c++': 'C++', csharp: '[Sharp]C', cs: '[Sharp]C',
  html: 'HTML', xml: 'XML', r: 'R', matlab: 'Matlab', bash: 'bash', sh: 'bash', shell: 'bash', sql: 'SQL',
  tex: 'TeX', latex: '[LaTeX]TeX', javascript: 'Java', js: 'Java', fortran: 'Fortran', ruby: 'Ruby', perl: 'Perl',
};

function mathBlock(block: MathBlockNode): string {
  const label = block.label ?? (block.number != null ? String(block.number) : undefined);
  let out = '';
  if (block.dir === 'rtl') {
    out += '% This equation is right-to-left ($$[rtl]) in the app; LaTeX has no\n% standard RTL math, so it is exported left-to-right.\n';
  }
  out += `\\begin{equation}\n`;
  if (label) out += `\\label{eq:${latexLabel(label)}}\n`;
  out += `${arabicInMathForLatex(block.value)}\n\\end{equation}\n\n`;
  return out;
}

function withLanguage(text: string, body: string, ctx: Ctx): string {
  const env = ctx.wrapRuns ? blockLanguageEnv(text, ctx.rtl) : null;
  return env ? `\\begin{${env}}\n${body}\n\\end{${env}}\n\n` : `${body}\n\n`;
}

function renderBlocks(blocks: BlockNode[], ctx: Ctx): string {
  let out = '';
  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const level = Math.max(1, block.level - ctx.headingShift);
        const cmd = ['section', 'subsection', 'subsubsection'][Math.min(level, 3) - 1] ?? 'subsubsection';
        out += `\\${cmd}{${renderInline(block.children, ctx)}}\n\n`;
        break;
      }
      case 'paragraph': {
        const text = plain(block.children);
        const env = ctx.wrapRuns ? blockLanguageEnv(text, ctx.rtl) : null;
        const inner = renderInline(block.children, env ? { ...ctx, wrapRuns: false } : ctx);
        out += env ? `\\begin{${env}}\n${inner}\n\\end{${env}}\n\n` : `${inner}\n\n`;
        break;
      }
      case 'thematicBreak':
        out += `\\noindent\\hrulefill\n\n`;
        break;
      case 'codeBlock': {
        if (ARABIC.test(block.value)) {
          // A fence holding Arabic prose (common in classical notes), not code:
          // listings cannot shape or order Arabic and the mono font has none.
          // Keep its line breaks in a quote block in the Arabic font.
          const lines = block.value.split('\n').map((l) => textRuns(l, ctx) || '~');
          const quote = `\\begin{quote}\n${lines.join(' \\\\\n')}\n\\end{quote}`;
          out += ctx.rtl ? `${quote}\n\n` : `\\begin{Arabic}\n${quote}\n\\end{Arabic}\n\n`;
          break;
        }
        const lang = LISTINGS_LANGUAGES[(block.language || '').toLowerCase()];
        const listing = `\\begin{lstlisting}${lang ? `[language=${lang}]` : ''}\n${block.value}\n\\end{lstlisting}`;
        // code is always left-to-right
        out += ctx.rtl ? `\\begin{english}\n${listing}\n\\end{english}\n\n` : `${listing}\n\n`;
        break;
      }
      case 'blockquote':
        out += `\\begin{quote}\n${renderBlocks(block.children, ctx).trim()}\n\\end{quote}\n\n`;
        break;
      case 'list': {
        const env = block.ordered ? 'enumerate' : 'itemize';
        out += `\\begin{${env}}\n`;
        for (const item of block.items) {
          const mark = item.checked === undefined ? '' : item.checked ? '[$\\boxtimes$]' : '[$\\square$]';
          out += `  \\item${mark} ${renderBlocks(item.children, ctx).trim().replace(/\n/g, '\n  ')}\n`;
        }
        out += `\\end{${env}}\n\n`;
        break;
      }
      case 'imageFigure':
        out += `\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{${block.src}}\n`;
        if (block.caption) out += `  \\caption{${textRuns(block.caption, ctx)}}\n`;
        if (block.id) out += `  \\label{${latexLabel(block.id)}}\n`;
        out += `\\end{figure}\n\n`;
        break;
      case 'table':
        out += `\\begin{table}[htbp]\n  \\centering\n${renderTable(block.header, block.body, ctx)}\n`;
        if (block.caption) out += `  \\caption{${textRuns(block.caption, ctx)}}\n`;
        out += `\\end{table}\n\n`;
        break;
      case 'mathBlock':
        out += mathBlock(block);
        break;
      case 'footnoteDefinition':
        break; // rendered inline at the reference as \footnote{…}
      case 'poetry':
        out += `\\begin{verse}\n`;
        out += block.verses
          .map((v) => `  ${textRuns(v.sadr, ctx)}${v.ajuz ? ` \\qquad ${textRuns(v.ajuz, ctx)}` : ''}`)
          .join(' \\\\\n');
        out += `\n\\end{verse}\n\n`;
        break;
      case 'academicBlock': {
        const label = (block.number != null ? blockRefText(block.blockType, block.number, ctx.rtl ? 'ar' : 'en') : null) ?? block.blockType;
        out += `\\par\\medskip\\noindent\\textbf{${escapeLatex(label)}.}~${renderBlocks(block.children, ctx).trim()}\\par\\medskip\n\n`;
        break;
      }
      case 'matn':
        out += `\\begin{center}\n${renderBlocks(block.children, ctx).trim()}\n\\end{center}\n\n`;
        break;
      case 'sharh':
        out += renderBlocks(block.children, ctx);
        break;
      case 'hashiyah':
        out += `{\\small\n${renderBlocks(block.children, ctx).trim()}\n}\n\n`;
        break;
      case 'figureGroup':
        out += renderBlocks(block.children as BlockNode[], ctx);
        break;
      case 'htmlBlock':
        out += `% (raw HTML omitted)\n`;
        break;
    }
  }
  return out;
}

function renderTable(header: TableRowNode[], body: TableRowNode[], ctx: Ctx): string {
  if (!header.length && !body.length) return '';
  const first = header[0] ?? body[0];
  const align = first.cells
    .map((c) => (c.align === 'center' ? 'c' : c.align === 'right' ? 'r' : 'l'))
    .join('|');
  const row = (r: TableRowNode) => `  ${r.cells.map((c) => renderInline(c.children, ctx)).join(' & ')} \\\\`;
  let out = `  \\begin{tabular}{|${align}|}\n  \\hline\n`;
  if (header.length) out += `${row(header[0])} \\hline\n`;
  for (const r of body) out += `${row(r)}\n`;
  out += `  \\hline\n  \\end{tabular}`;
  return out;
}

function renderBibliography(entries: BibEntry[], ctx: Ctx): string {
  if (!entries.length) return '';
  let out = `\\begin{thebibliography}{99}\n`;
  for (const e of entries) {
    const authors = e.fields.author ? textRuns(e.fields.author.replace(/[{}]/g, ''), ctx) : '';
    const title = e.fields.title ? textRuns(e.fields.title.replace(/[{}]/g, ''), ctx) : '';
    const year = e.fields.year ? escapeLatex(e.fields.year.replace(/[{}]/g, '')) : '';
    out += `  \\bibitem{${e.key}} ${authors}, \\emph{${title}} (${year}).\n`;
  }
  out += `\\end{thebibliography}\n`;
  return out;
}

/* ── document-wide passes ── */

function walk(blocks: BlockNode[], visit: (b: BlockNode) => void): void {
  for (const b of blocks) {
    visit(b);
    if ('children' in b && Array.isArray(b.children)) walk(b.children as BlockNode[], visit);
    if (b.type === 'list') for (const it of b.items) walk(it.children, visit);
  }
}

function inlineMath(nodes: InlineNode[], acc: string[]): void {
  for (const n of nodes) {
    if (n.type === 'inlineMath') acc.push(n.value);
    if ('children' in n) inlineMath(n.children, acc);
  }
}

/** All math in the document, all prose, footnote definitions, and number→label map for equations. */
function scan(model: DocumentModel) {
  const math: string[] = [];
  const footnotes = new Map<string, BlockNode[]>();
  const eqLabels = new Map<string, string>();
  let prose = '';
  walk(model.blocks, (b) => {
    if (b.type === 'mathBlock') {
      math.push(b.value);
      if (b.label && b.number != null) eqLabels.set(String(b.number), b.label);
    }
    if (b.type === 'footnoteDefinition') footnotes.set(b.id, b.children);
    if (b.type === 'heading' || b.type === 'paragraph') {
      inlineMath(b.children, math);
      prose += plain(b.children);
    }
    if (b.type === 'table') for (const r of [...b.header, ...b.body]) for (const c of r.cells) {
      inlineMath(c.children, math);
      prose += plain(c.children);
    }
    if (b.type === 'poetry') for (const v of b.verses) prose += v.sadr + (v.ajuz ?? '');
  });
  return { math, footnotes, eqLabels, prose };
}

export class LatexExporter implements Exporter {
  readonly name = 'latex';
  readonly label = 'LaTeX';
  readonly extensions = ['tex'];

  export(model: DocumentModel): ExportResult {
    const rtl = model.meta.direction === 'rtl' || model.meta.lang === 'ar';
    const { math, footnotes, eqLabels, prose } = scan(model);
    const symbols = latexSymbolSetup(math, getSymbols());
    const needsXelatex = rtl || ARABIC.test(prose) || math.some((m) => ARABIC.test(m)) || symbols.used.length > 0;
    // The title is set by \maketitle; don't repeat the first H1 as a section.
    const { blocks, headingShift } = bodyWithoutTitle(model);
    const ctx: Ctx = { rtl, wrapRuns: needsXelatex, footnotes, eqLabels, headingShift };

    const preamble = buildLatexPreamble({
      rtl,
      xelatex: needsXelatex,
      numerals: numeralsFor(model.meta.digitStyle, rtl),
      arabicFont: typeof model.meta.arabicFont === 'string' ? model.meta.arabicFont : undefined,
      title: model.meta.title,
      author: model.meta.author,
      date: model.meta.date,
      packages: symbols.packages,
      definitions: symbols.definitions,
    });
    const body = renderBlocks(blocks, ctx);
    const bib = renderBibliography(model.bibEntries, ctx);
    return {
      content: `${preamble}\n${body}\n${bib}\n\\end{document}\n`,
      extension: 'tex',
      mime: 'application/x-latex',
    };
  }
}
