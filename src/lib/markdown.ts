/**
 * Markdown → HTML for the preview and print view.
 *
 * All syntax lives in markdown-it plugins under `src/lib/md/`; this module
 * only runs the shared parser and returns the HTML together with everything
 * the render discovered (equations, figures, tables, citations, warnings).
 * There is no module-level render state.
 */
import 'katex/dist/katex.min.css';
import type { BibEntry } from './bibliography';
import { generateBibliographyHtml } from './bibliography';
import { getParser, parse } from './md/parser';
import {
  createEnv,
  type BlockInfo,
  type DigitStyle,
  type EquationInfo,
  type FigureInfo,
  type RenderOptions,
  type RenderWarning,
  type TableInfo,
} from './md/env';

export type { DigitStyle, EquationInfo, FigureInfo, TableInfo, BlockInfo, RenderOptions, RenderWarning };

export interface DocumentAnalysis {
  equations: EquationInfo[];
  figures: FigureInfo[];
  tables: TableInfo[];
  blocks: BlockInfo[];
  citations: { used: string[]; missing: string[] };
  warnings: RenderWarning[];
}

export interface RenderResult extends DocumentAnalysis {
  html: string;
}

const RENDER_ERROR_HTML = '<p style="color:#ff6b6b">خطأ في تحليل المستند</p>';

export function renderDocument(text: string, options: RenderOptions = {}): RenderResult {
  const md = getParser();
  const env = createEnv(options);
  let html: string;
  try {
    const tokens = md.parse(text, env);
    html = md.renderer.render(tokens, md.options, env);
  } catch (e) {
    env.warnings.push({ kind: 'render', message: e instanceof Error ? e.message : String(e) });
    html = RENDER_ERROR_HTML;
  }
  const bib = options.bibEntries ?? [];
  if (bib.length > 0 && (env.citations.used.length > 0 || env.citations.missing.length > 0)) {
    html += generateBibliographyHtml(env.citations.used, bib, env.citations.missing);
  }
  return {
    html,
    equations: env.equations,
    figures: env.figures,
    tables: env.tables,
    blocks: env.blocks,
    citations: env.citations,
    warnings: env.warnings,
  };
}

/** HTML only. Kept for callers that need nothing else. */
export function renderMarkdown(text: string, bibEntries?: BibEntry[], digitStyle?: DigitStyle): string {
  return renderDocument(text, { bibEntries, digitStyle }).html;
}

/** Numbering, labels and citations without producing HTML (no KaTeX work). */
export function analyzeMarkdown(text: string, options: RenderOptions = {}): DocumentAnalysis {
  const { env } = parse(text, options);
  return {
    equations: env.equations,
    figures: env.figures,
    tables: env.tables,
    blocks: env.blocks,
    citations: env.citations,
    warnings: env.warnings,
  };
}

export function parseEquationsFromText(text: string): EquationInfo[] {
  return analyzeMarkdown(text).equations;
}

export function parseFigures(markdown: string): FigureInfo[] {
  return analyzeMarkdown(markdown).figures;
}

export function parseTables(markdown: string): TableInfo[] {
  return analyzeMarkdown(markdown).tables;
}

export interface OutlineItem {
  id: string;
  level: number;
  text: string;
  lineIndex: number;
  charOffset: number;
}

function computeLineOffsets(text: string): number[] {
  const offsets: number[] = [];
  let offset = 0;
  for (const line of text.split('\n')) {
    offsets.push(offset);
    offset += line.length + 1;
  }
  return offsets;
}

/**
 * Headings from the same token stream the preview uses. This includes headings
 * inside `:::` containers, blockquotes and list items, and ignores `#` lines
 * inside fenced code blocks.
 */
export function analyzeOutline(text: string): OutlineItem[] {
  const { tokens } = parse(text);
  const offsets = computeLineOffsets(text);
  const items: OutlineItem[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type !== 'heading_open') continue;
    const lineIndex = token.map?.[0] ?? 0;
    const inline = tokens[i + 1];
    items.push({
      id: `h-${lineIndex}`,
      level: Number(token.tag.slice(1)) || 1,
      text: inline?.type === 'inline' ? inline.content.trim() : '',
      lineIndex,
      charOffset: offsets[lineIndex] ?? 0,
    });
  }

  return items;
}
