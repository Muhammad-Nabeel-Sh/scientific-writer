/**
 * DocumentModel → Typst (E4).
 *
 * Math goes through the mitex package, which renders LaTeX math in Typst.
 * Registry macros are expanded first (mitex cannot know them); glyph symbols
 * become their Unicode characters, drawn by Katib Math (the math font).
 * Block equations are numbered by Typst and labelled <eq-N> / <eq:label>, so
 * references are real Typst references (@…).
 *
 * Known limits (documented in the export header):
 *  - $$[rtl]$$ equations are exported left-to-right (Typst math is LTR);
 *  - mirrored operators (\rsum …) are exported unmirrored.
 */
import type { Exporter, ExportResult } from './exporter';
import type { BlockNode, DocumentModel, InlineNode, MathBlockNode, TableRowNode } from './ast';
import { formatBibliographyEntry, formatInText, type BibEntry } from '../bibliography';
import { blockRefText } from '../blocks';
import { getSymbols, type MathSymbol } from '../math';
import { expandMacros, stripHtmlClass, unwrapCommand } from '../math/tex-macros';
import { bodyWithoutTitle } from './title';

export const MITEX_VERSION = '0.2.7';

/* ── math ── */

/** A symbol's body for mitex: KaTeX body, glyphs as their character, no KaTeX-only commands. */
export function typstMathBody(sym: MathSymbol): string {
  if (sym.katex.kind === 'glyph') return sym.typst ?? sym.unicode ?? sym.katex.char;
  let body = stripHtmlClass(sym.katex.body);
  body = unwrapCommand(body, '\\swmirror');
  return body;
}

/** LaTeX math ready for mitex. */
export function mathForTypst(tex: string, symbols: MathSymbol[] = getSymbols()): string {
  return expandMacros(tex, symbols, typstMathBody);
}

/** A Typst string literal. */
function str(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
}

/** Typst label for an equation id (eq-3, eq:energy). */
export function typstLabel(id: string): string {
  return id.replace(/[^\p{L}\p{N}:._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'eq';
}

/* ── text ── */

/** Escape Typst markup characters in prose. */
export function escapeTypst(s: string): string {
  return s
    .replace(/[\\#$@*_`<>\[\]~=/+\-]/g, (m) => `\\${m}`)
    .replace(/"/g, '\\"');
}

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/**
 * Latin-only text inside an RTL document (citations, reference entries) is
 * set in its own left-to-right box, so bidi does not scatter its punctuation
 * ("(Smith, 2020)" otherwise breaks apart). Arabic text stays as it is.
 */
function isolate(text: string, rtl: boolean): string {
  const escaped = escapeTypst(text);
  return rtl && !ARABIC.test(text) ? `#box(text(dir: ltr)[${escaped}])` : escaped;
}

interface Ctx {
  rtl: boolean;
  /** 1 when the only H1 became the document title (see title.ts). */
  headingShift?: number;
  footnotes: Map<string, BlockNode[]>;
  /** equation number or label → Typst label */
  eqLabels: Map<string, string>;
  bib: Map<string, BibEntry>;
}

function renderInline(nodes: InlineNode[], ctx: Ctx): string {
  let out = '';
  for (const n of nodes) {
    switch (n.type) {
      case 'text': out += escapeTypst(n.value); break;
      case 'strong': out += `#strong[${renderInline(n.children, ctx)}]`; break;
      case 'emphasis': out += `#emph[${renderInline(n.children, ctx)}]`; break;
      case 'strikethrough': out += `#strike[${renderInline(n.children, ctx)}]`; break;
      case 'inlineCode': out += `#raw(${str(n.value)})`; break;
      case 'link': out += `#link(${str(n.url)})[${renderInline(n.children, ctx)}]`; break;
      case 'inlineMath': out += `#mi(${str(mathForTypst(n.value))})`; break;
      case 'footnoteRef': {
        const def = ctx.footnotes.get(n.id);
        if (def) out += `#footnote[${renderBlocks(def, ctx).trim()}]`;
        break;
      }
      case 'citation': {
        const e = ctx.bib.get(n.key);
        out += isolate(e ? `(${formatInText(e)})` : `?${n.key}?`, ctx.rtl);
        break;
      }
      case 'equationRef': {
        const label = ctx.eqLabels.get(n.ref);
        out += label ? `@${label}` : escapeTypst(n.display ?? `(${n.ref})`);
        break;
      }
      case 'blockRef': out += escapeTypst(n.display || n.ref); break;
      case 'wikiLink': out += escapeTypst(n.display || n.target); break;
      case 'lineBreak': out += ` \\\n`; break;
      case 'inlineImage': out += `#box(image(${str(n.src)}, height: 1em))`; break;
    }
  }
  return out;
}

function mathBlock(b: MathBlockNode, ctx: Ctx): string {
  const label = b.id ? typstLabel(b.id) : undefined;
  const note = b.dir === 'rtl' ? '// right-to-left in the app ($$[rtl]); Typst math is left-to-right\n' : '';
  return `${note}#mitex(${str(mathForTypst(b.value))})${label ? ` <${label}>` : ''}\n\n`;
}

function indent(s: string, prefix = '  '): string {
  return s.split('\n').map((l, i) => (i === 0 || !l ? l : prefix + l)).join('\n');
}

function renderBlocks(blocks: BlockNode[], ctx: Ctx): string {
  let out = '';
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        out += `${'='.repeat(Math.max(1, block.level - (ctx.headingShift ?? 0)))} ${renderInline(block.children, ctx)}\n\n`;
        break;
      case 'paragraph':
        out += `${renderInline(block.children, ctx)}\n\n`;
        break;
      case 'thematicBreak':
        out += `#line(length: 100%)\n\n`;
        break;
      case 'codeBlock':
        out += `#raw(${str(block.value)}, block: true${block.language ? `, lang: ${str(block.language)}` : ''})\n\n`;
        break;
      case 'blockquote':
        out += `#quote(block: true)[\n${renderBlocks(block.children, ctx).trim()}\n]\n\n`;
        break;
      case 'list': {
        const marker = block.ordered ? '+' : '-';
        if (block.ordered && block.start && block.start !== 1) out += `#set enum(start: ${block.start})\n`;
        for (const item of block.items) {
          const box = item.checked === undefined ? '' : item.checked ? '☑ ' : '☐ ';
          out += `${marker} ${box}${indent(renderBlocks(item.children, ctx).trim())}\n`;
        }
        out += '\n';
        break;
      }
      case 'imageFigure':
        out += `#figure(\n  image(${str(block.src)}, width: 80%),\n  caption: [${escapeTypst(block.caption || block.alt)}],\n)${block.id ? ` <${typstLabel(block.id)}>` : ''}\n\n`;
        break;
      case 'table':
        out += renderTable(block.header, block.body, block.caption, ctx);
        break;
      case 'mathBlock':
        out += mathBlock(block, ctx);
        break;
      case 'footnoteDefinition':
        break; // rendered inline as #footnote[…]
      case 'poetry':
        out += `#align(center, grid(columns: 2, column-gutter: 3em, row-gutter: 0.8em,\n`;
        for (const v of block.verses) {
          out += `  [${escapeTypst(v.sadr)}], [${escapeTypst(v.ajuz ?? '')}],\n`;
        }
        out += `))\n\n`;
        break;
      case 'academicBlock': {
        const label = (block.number != null ? blockRefText(block.blockType, block.number, ctx.rtl ? 'ar' : 'en') : null) ?? block.blockType;
        // the bar goes on the start side: right in RTL documents
        out += `#block(stroke: (${ctx.rtl ? 'right' : 'left'}: 2pt + gray), inset: (x: 10pt, y: 6pt), width: 100%)[\n*${escapeTypst(label)}.* ${renderBlocks(block.children, ctx).trim()}\n]\n\n`;
        break;
      }
      case 'matn':
        out += `#align(center)[\n${renderBlocks(block.children, ctx).trim()}\n]\n\n`;
        break;
      case 'sharh':
        out += renderBlocks(block.children, ctx);
        break;
      case 'hashiyah':
        out += `#text(size: 0.85em)[\n${renderBlocks(block.children, ctx).trim()}\n]\n\n`;
        break;
      case 'figureGroup':
        out += renderBlocks(block.children as BlockNode[], ctx);
        break;
      case 'htmlBlock':
        out += `// (raw HTML omitted)\n\n`;
        break;
    }
  }
  return out;
}

function renderTable(header: TableRowNode[], body: TableRowNode[], caption: string | undefined, ctx: Ctx): string {
  const first = header[0] ?? body[0];
  if (!first) return '';
  const cols = first.cells.length;
  const align = first.cells.map((c) => (c.align === 'center' ? 'center' : c.align === 'right' ? 'right' : 'start'));
  const cell = (c: { children: InlineNode[] }) => `[${renderInline(c.children, ctx)}]`;
  let t = `table(\n    columns: ${cols},\n    align: (${align.join(', ')},),\n`;
  if (header[0]) t += `    table.header(${header[0].cells.map(cell).join(', ')}),\n`;
  for (const r of body) t += `    ${r.cells.map(cell).join(', ')},\n`;
  t += `  )`;
  return caption ? `#figure(\n  ${t},\n  caption: [${escapeTypst(caption)}],\n)\n\n` : `#${t}\n\n`;
}

function renderBibliography(entries: BibEntry[], rtl: boolean): string {
  if (!entries.length) return '';
  let out = `${rtl ? '= المراجع' : '= References'}\n\n`;
  entries.forEach((e, i) => {
    const text = formatBibliographyEntry(e, i + 1).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
    // Latin entries in an RTL document: a left-to-right, start-aligned paragraph
    out += rtl && !ARABIC.test(text)
      ? `#block(width: 100%, align(right, text(dir: ltr)[${escapeTypst(text)}]))\n\n`
      : `${escapeTypst(text)}\n\n`;
  });
  return out;
}

/* ── document-wide pass ── */

function walk(blocks: BlockNode[], visit: (b: BlockNode) => void): void {
  for (const b of blocks) {
    visit(b);
    if ('children' in b && Array.isArray(b.children)) walk(b.children as BlockNode[], visit);
    if (b.type === 'list') for (const it of b.items) walk(it.children, visit);
  }
}

function safeFontName(font: unknown): string {
  const f = typeof font === 'string' ? font.replace(/[^A-Za-z0-9 ._-]/g, '').trim() : '';
  return f || 'Amiri';
}

export class TypstExporter implements Exporter {
  readonly name = 'typst';
  readonly label = 'Typst';
  readonly extensions = ['typ'];

  export(model: DocumentModel): ExportResult {
    const rtl = model.meta.direction === 'rtl' || model.meta.lang === 'ar';
    const footnotes = new Map<string, BlockNode[]>();
    const eqLabels = new Map<string, string>();
    walk(model.blocks, (b) => {
      if (b.type === 'footnoteDefinition') footnotes.set(b.id, b.children);
      if (b.type === 'mathBlock' && b.id) {
        const label = typstLabel(b.id);
        if (b.number != null) eqLabels.set(String(b.number), label);
        if (b.label) eqLabels.set(b.label, label);
      }
    });
    const ctx: Ctx = { rtl, footnotes, eqLabels, bib: new Map(model.bibEntries.map((e) => [e.key, e])) };

    const font = safeFontName(model.meta.arabicFont);
    const header = [
      '// Compile with: typst compile --font-path <dir with KatibMath-Regular.otf and Amiri> <file>.typ',
      `// KatibMath-Regular.otf: fonts-src/katib-math/dist/ (الكاتب العلمي).`,
      '// Known limits: right-to-left ($$[rtl]) equations and mirrored operators are exported left-to-right / unmirrored.',
      `#import "@preview/mitex:${MITEX_VERSION}": mitex, mi`,
      '#set page(paper: "a4", margin: 2.5cm)',
      `#set text(font: (${str(font)}, "Katib Math"), lang: "${rtl ? 'ar' : 'en'}", dir: ${rtl ? 'rtl' : 'ltr'}, size: 12pt)`,
      '#set par(justify: true)',
      // Arabic documents: number on the left (the end side in RTL), Arabic-Indic
      // digits unless the document's digit style is Western.
      rtl
        ? `#set math.equation(numbering: "${model.meta.digitStyle === 'western' ? '(1)' : '(١)'}", number-align: left + horizon)`
        : '#set math.equation(numbering: "(1)")',
      '#show math.equation: set text(font: "Katib Math")',
      '#show raw: set text(dir: ltr)',
      '// Math is laid out left-to-right even inside Arabic paragraphs.',
      '#show math.equation: set text(dir: ltr)',
      '',
    ].join('\n');

    const title = model.meta.title ? `#align(center, text(size: 1.6em, weight: "bold")[${escapeTypst(model.meta.title)}])\n\n` : '';
    const { blocks, headingShift } = bodyWithoutTitle(model);
    ctx.headingShift = headingShift;
    const body = renderBlocks(blocks, ctx);
    const bib = renderBibliography(model.bibEntries, rtl);
    return { content: `${header}\n${title}${body}${bib}`, extension: 'typ', mime: 'text/plain' };
  }
}
