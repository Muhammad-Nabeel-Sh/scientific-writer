/**
 * Per-render state for the markdown pipeline.
 *
 * Everything a render produces besides HTML (numbering, labels, citations,
 * warnings) lives in this object, which markdown-it threads through every
 * rule as `env`. Nothing is kept in module-level variables, so renders are
 * independent and can run concurrently.
 */
import type { BibEntry } from '../bibliography';

export type DigitStyle = 'auto' | 'eastern' | 'western';

/** Language used for generated labels ("Figure"/"الشكل" …). 'auto' guesses per element. */
export type LabelLang = 'auto' | 'ar' | 'en';

export interface RenderOptions {
  bibEntries?: BibEntry[];
  digitStyle?: DigitStyle;
  labelLang?: LabelLang;
  /** Default direction for math. 'rtl' is experimental (MathML only, see docs/rtl-math-spike.md). */
  mathDir?: 'ltr' | 'rtl';
  /** Map a `[[wiki link]]` target name to a note id. Without it, wiki links stay literal text. */
  resolveWikiLink?: (name: string) => string | null | undefined;
}

export interface EquationInfo {
  id: string;
  number: number;
  label?: string;
  latex: string;
  /** 0-based source line of the opening `$$`. */
  line?: number;
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

export interface BlockInfo {
  id: string;
  type: string;
  number: number;
  label?: string;
}

export interface RenderWarning {
  kind: 'math' | 'ref' | 'citation' | 'render';
  message: string;
  /** 0-based source line, when known. */
  line?: number;
  /** For math warnings: 'undefined-macro' | 'parse' | 'strict'. */
  code?: string;
  /** For 'undefined-macro': the macro name without backslash (feeds "add as custom symbol"). */
  macro?: string;
}

export interface RenderEnv {
  options: Required<Pick<RenderOptions, 'digitStyle' | 'labelLang'>> & RenderOptions;
  equations: EquationInfo[];
  figures: FigureInfo[];
  tables: TableInfo[];
  blocks: BlockInfo[];
  citations: { used: string[]; missing: string[] };
  warnings: RenderWarning[];
  /** Used by markdown-it-footnote. */
  footnotes?: any;
  [key: string]: unknown;
}

export function createEnv(options: RenderOptions = {}): RenderEnv {
  return {
    options: { digitStyle: 'auto', labelLang: 'auto', ...options },
    equations: [],
    figures: [],
    tables: [],
    blocks: [],
    citations: { used: [], missing: [] },
    warnings: [],
  };
}

export const ARABIC_RE = /[؀-ۿ]/;

export function hasArabic(text: string): boolean {
  return ARABIC_RE.test(text);
}

/** Pick 'ar' or 'en' for a generated label, honouring an explicit document language. */
export function labelLanguage(env: RenderEnv, sample: string): 'ar' | 'en' {
  const l = env.options.labelLang;
  if (l === 'ar' || l === 'en') return l;
  return hasArabic(sample) ? 'ar' : 'en';
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
