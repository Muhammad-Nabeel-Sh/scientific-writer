import type { Exporter, ExportResult } from './exporter';
import type { DocumentModel, BlockNode, InlineNode, TableRowNode } from './ast';
import type { BibEntry } from '../bibliography';

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
}

/** Map the app's digit style to polyglossia's Arabic numerals option. */
export function numeralsFor(digitStyle: unknown, rtl: boolean): LatexNumerals {
  if (digitStyle === 'western') return 'maghrib';
  if (digitStyle === 'eastern') return 'mashriq';
  return rtl ? 'mashriq' : 'maghrib';
}

function safeArabicFont(font: string | undefined): string {
  const cleaned = (font || 'Amiri').replace(/[^A-Za-z0-9 ._-]/g, '').trim();
  return cleaned || 'Amiri';
}

export function buildLatexPreamble(o: LatexPreambleOptions): string {
  const arabicFont = safeArabicFont(o.arabicFont);
  const title = escapeLatex(o.title || '');
  const author = escapeLatex(o.author || '');
  const date = escapeLatex(o.date || '');
  const common = `\\usepackage{amsmath,amssymb,mathtools}
\\usepackage{hyperref}
\\usepackage{graphicx}
\\usepackage{listings}
\\usepackage{soul}
\\usepackage{caption}
\\usepackage{geometry}
\\geometry{right=2.5cm,left=2.5cm,top=2.5cm,bottom=2.5cm}`;

  if (o.rtl) {
    return `% Compile with: xelatex <file>.tex
% Place fonts-src/katib-math/dist/KatibMath-Regular.otf next to this file.
\\documentclass[12pt,a4paper]{article}
${common}
\\usepackage{fontspec}
\\usepackage{unicode-math}
\\usepackage{polyglossia}
\\setmainlanguage[numerals=${o.numerals}]{arabic}
\\setotherlanguage{english}
\\setmainfont{${arabicFont}}
\\newfontfamily\\arabicfont[Script=Arabic,Scale=1.2]{${arabicFont}}
\\setmathfont[Path=./]{KatibMath-Regular.otf}
\\begin{document}
\\title{${title}}
\\author{${author}}
\\date{${date}}
\\maketitle
`;
  }

  return `\\documentclass[12pt,a4paper]{article}
${common}
\\usepackage[utf8]{inputenc}
\\begin{document}
\\title{${title}}
\\author{${author}}
\\date{${date}}
\\maketitle
`;
}

function renderInline(nodes: InlineNode[]): string {
  let out = '';
  for (const n of nodes) {
    switch (n.type) {
      case 'text': out += escapeLatex(n.value); break;
      case 'strong': out += `\\textbf{${renderInline(n.children)}}`; break;
      case 'emphasis': out += `\\emph{${renderInline(n.children)}}`; break;
      case 'strikethrough': out += `\\sout{${renderInline(n.children)}}`; break;
      case 'inlineCode': out += `\\texttt{${escapeLatex(n.value)}}`; break;
      case 'link': out += `\\href{${n.url}}{${renderInline(n.children)}}`; break;
      case 'inlineMath': out += `$${n.value}$`; break;
      case 'footnoteRef': out += `\\footnotemark[${n.id}]`; break;
      case 'citation': out += `\\cite{${n.key}}`; break;
      case 'equationRef': out += `\\eqref{eq:${latexLabel(n.ref)}}`; break;
      case 'blockRef': out += `(${escapeLatex(n.display || n.ref)})`; break;
      case 'wikiLink': out += escapeLatex(n.display || n.target); break;
      case 'lineBreak': out += `\\\\`; break;
      case 'inlineImage': out += `\\includegraphics{${n.src}}`; break;
    }
  }
  return out;
}

function renderBlocks(blocks: BlockNode[]): string {
  let out = '';
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        const lvl = Math.min(block.level, 3);
        const cmd = ['\\section{', '\\subsection{', '\\subsubsection{'][lvl - 1] || '\\subsubsection{';
        out += `${cmd}${renderInline(block.children)}}\n\n`;
        break;
      case 'paragraph':
        out += `${renderInline(block.children)}\n\n`;
        break;
      case 'thematicBreak':
        out += `\\hrulefill\n\n`;
        break;
      case 'codeBlock':
        out += `\\begin{lstlisting}[language=${block.language || ''}]\n${block.value}\n\\end{lstlisting}\n\n`;
        break;
      case 'blockquote':
        out += `\\begin{quote}\n${renderBlocks(block.children)} \\end{quote}\n\n`;
        break;
      case 'list':
        const env = block.ordered ? 'enumerate' : 'itemize';
        out += `\\begin{${env}}\n`;
        for (const item of block.items) {
          out += `  \\item ${renderBlocks(item.children).trim().replace(/\n/g, '\n  ')}\n`;
        }
        out += `\\end{${env}}\n\n`;
        break;
      case 'imageFigure':
        out += `\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics{${block.src}}\n`;
        if (block.caption) out += `  \\caption{${escapeLatex(block.caption)}}\n`;
        out += `\\end{figure}\n\n`;
        break;
      case 'table':
        out += renderTable(block.header, block.body);
        if (block.caption) out += `\n\\captionof{table}{${escapeLatex(block.caption)}}\n`;
        out += '\n';
        break;
      case 'mathBlock':
        const eqLabel = block.label ?? (block.number != null ? String(block.number) : undefined);
        out += `\\begin{equation}\n`;
        if (eqLabel) out += `\\label{eq:${latexLabel(eqLabel)}}\n`;
        out += `${block.value}\n\\end{equation}\n\n`;
        break;
      case 'footnoteDefinition':
        out += `\\footnotetext[${block.id}]{${renderBlocks(block.children).trim()}}\n\n`;
        break;
      case 'poetry':
        out += `\\begin{verse}\n`;
        for (const v of block.verses) {
          out += `  ${v.sadr}${v.ajuz ? ` \\\\ ${v.ajuz}` : ''}\\\\`;
        }
        out += `\n\\end{verse}\n\n`;
        break;
      case 'academicBlock':
      case 'matn':
      case 'sharh':
      case 'hashiyah':
      case 'figureGroup':
        if ('children' in block) out += renderBlocks((block as any).children as BlockNode[]);
        break;
      case 'htmlBlock':
        break;
    }
  }
  return out;
}

function renderTable(header: TableRowNode[], body: TableRowNode[]): string {
  if (!header.length && !body.length) return '';
  const cols = header.length ? header[0].cells.length : body[0].cells.length;
  const align = header.length ? header[0].cells.map(c => c.align === 'center' ? 'c' : c.align === 'right' ? 'r' : 'l').join('|') : 'l'.repeat(cols);
  let out = `\\begin{tabular}{${align}}\n  \\hline\n`;
  if (header.length) out += `  ${header[0].cells.map(c => renderInline(c.children)).join(' & ')} \\\\ \\hline\n`;
  for (const r of body) {
    out += `  ${r.cells.map(c => renderInline(c.children)).join(' & ')} \\\\\n`;
  }
  out += `  \\hline\n\\end{tabular}`;
  return out;
}

function renderBibliography(entries: BibEntry[]): string {
  if (!entries.length) return '';
  let out = `\\begin{thebibliography}{99}\n`;
  for (const e of entries) {
    const authors = e.fields.author ? escapeLatex(e.fields.author) : '';
    const title = e.fields.title ? escapeLatex(e.fields.title) : '';
    const year = e.fields.year ? escapeLatex(e.fields.year) : '';
    out += `  \\bibitem{${e.key}} ${authors}, \\emph{${title}} (${year}).\n`;
  }
  out += `\\end{thebibliography}\n`;
  return out;
}

export class LatexExporter implements Exporter {
  readonly name = 'latex';
  readonly label = 'لا‌تخ';
  readonly extensions = ['tex'];

  export(model: DocumentModel): ExportResult {
    const rtl = model.meta.direction === 'rtl' || model.meta.lang === 'ar';
    const numerals = numeralsFor(model.meta.digitStyle, rtl);
    const preamble = buildLatexPreamble({
      rtl,
      numerals,
      arabicFont: typeof model.meta.arabicFont === 'string' ? model.meta.arabicFont : undefined,
      title: model.meta.title,
      author: model.meta.author,
      date: model.meta.date,
    });
    const body = renderBlocks(model.blocks);
    const bib = renderBibliography(model.bibEntries);
    return { content: `${preamble}\n${body}\n${bib}\n\\end{document}\n`, extension: 'tex', mime: 'application/x-latex' };
  }
}
