/**
 * Math symbol registry — the single source of truth for symbols that KaTeX
 * and standard LaTeX do not provide (Arabic function names, the Arabic
 * mathematical alphabet, engineering notation, the author's own symbols).
 *
 * One definition drives every output: KaTeX macros for the preview (here),
 * and later LaTeX preambles, Typst and Pandoc headers (Phase 4).
 * Design: CRITIQUE_AND_PLAN.md §B.3.
 */
import { writable } from 'svelte/store';
import { normalizeArabic } from '../search';
import { isKatexCommand, setMathMacros } from './katex-instance';

export type SymbolCategory =
  | 'arabic-letter'
  | 'arabic-function'
  | 'operator'
  | 'relation'
  | 'arrow'
  | 'unit'
  | 'misc';

export const SYMBOL_CATEGORIES: readonly SymbolCategory[] = [
  'arabic-letter', 'arabic-function', 'operator', 'relation', 'arrow', 'unit', 'misc',
];

export type GlyphAtom = 'mathord' | 'mathop' | 'mathrel' | 'mathbin';

export type KatexImpl =
  /** Pure expansion using existing KaTeX commands, e.g. "\\operatorname{\\text{جا}}". */
  | { kind: 'macro'; body: string }
  /** A character KaTeX has no glyph for, drawn with a bundled font (class `sw-font-<font>`). */
  | { kind: 'glyph'; char: string; font: string; atom: GlyphAtom };

export interface MathSymbol {
  /** Macro name without backslash, e.g. "jaa". Letters only. */
  name: string;
  category: SymbolCategory;
  /** Label shown in the gallery, e.g. "جيب الزاوية". */
  labelAr: string;
  /** Search terms (Arabic and English). */
  keywords: string[];
  /** Unicode fallback for MathML / Typst / DOCX, e.g. "\u{1EE00}". */
  unicode?: string;
  /** Number of arguments (#1, #2 in macro bodies). */
  arity?: 0 | 1 | 2;
  katex: KatexImpl;
  /** LaTeX export (Phase 4, E3). */
  latex: { body: string; packages?: string[] };
  /** Typst export override (Phase 4, E4). */
  typst?: string;
  /** Mirror this operator in right-to-left math (∑, √, →). */
  mirrorInRtl?: boolean;
  /** Allow replacing a KaTeX built-in with the same name. */
  override?: boolean;
}

export type SymbolSource = 'builtin' | 'user';

interface Entry {
  symbol: MathSymbol;
  source: SymbolSource;
}

const NAME_RE = /^[A-Za-z]+$/;
const FONT_RE = /^[a-z0-9-]+$/;
const ATOMS: readonly GlyphAtom[] = ['mathord', 'mathop', 'mathrel', 'mathbin'];

const entries = new Map<string, Entry>();

/** Bumped on every change; the preview re-renders when it changes. */
export const mathRegistryVersion = writable(0);
let version = 0;

function changed(): void {
  setMathMacros(toKatexMacros());
  mathRegistryVersion.set(++version);
}

/** Problems with a symbol definition (empty array = valid). Messages are Arabic (shown in the UI). */
export function validateSymbol(sym: unknown): string[] {
  const errors: string[] = [];
  const s = sym as Partial<MathSymbol> | null;
  if (!s || typeof s !== 'object') return ['تعريف الرمز ليس كائنًا'];

  if (typeof s.name !== 'string' || !NAME_RE.test(s.name)) {
    errors.push(`اسم غير صالح "${String(s.name)}": يُسمح بالحروف اللاتينية فقط`);
  }
  if (!SYMBOL_CATEGORIES.includes(s.category as SymbolCategory)) {
    errors.push(`تصنيف غير معروف: ${String(s.category)}`);
  }
  if (typeof s.labelAr !== 'string' || !s.labelAr.trim()) errors.push('التسمية العربية مطلوبة');
  if (!Array.isArray(s.keywords) || s.keywords.some((k) => typeof k !== 'string')) {
    errors.push('الكلمات المفتاحية يجب أن تكون قائمة نصوص');
  }
  if (s.arity !== undefined && ![0, 1, 2].includes(s.arity)) errors.push('عدد المعاملات يجب أن يكون 0 أو 1 أو 2');

  const k = s.katex as Partial<KatexImpl> | undefined;
  if (!k || (k.kind !== 'macro' && k.kind !== 'glyph')) {
    errors.push('حقل katex يجب أن يكون macro أو glyph');
  } else if (k.kind === 'macro') {
    const body = (k as { body?: unknown }).body;
    if (typeof body !== 'string' || !body.trim()) errors.push('نص الماكرو فارغ');
    else {
      for (let i = 1; i <= (s.arity ?? 0); i++) {
        if (!body.includes(`#${i}`)) errors.push(`الماكرو لا يستخدم المعامل #${i}`);
      }
      if (s.name && new RegExp(`\\\\${s.name}(?![A-Za-z])`).test(body)) {
        errors.push('الماكرو يستدعي نفسه');
      }
    }
  } else {
    const g = k as Partial<Extract<KatexImpl, { kind: 'glyph' }>>;
    if (typeof g.char !== 'string' || [...g.char].length === 0 || [...g.char].length > 4) {
      errors.push('الحرف (char) يجب أن يكون من 1 إلى 4 محارف');
    } else if (/[\\{}$%#&~^_]/.test(g.char)) {
      errors.push('الحرف (char) يحتوي على رموز TeX خاصة');
    }
    if (typeof g.font !== 'string' || !FONT_RE.test(g.font)) errors.push(`اسم خط غير صالح: ${String(g.font)}`);
    if (!ATOMS.includes(g.atom as GlyphAtom)) errors.push(`نوع غير صالح: ${String(g.atom)}`);
  }

  if (!s.latex || typeof s.latex.body !== 'string' || !s.latex.body.trim()) {
    errors.push('حقل latex.body مطلوب للتصدير');
  }
  return errors;
}

/** The KaTeX expansion of a symbol. */
export function katexExpansion(sym: MathSymbol): string {
  if (sym.katex.kind === 'macro') return sym.katex.body;
  const { char, font, atom } = sym.katex;
  return `\\${atom}{\\htmlClass{sw-sym sw-font-${font}}{\\text{${char}}}}`;
}

/** Validation plus registry-level checks: duplicates and shadowing KaTeX built-ins. */
function admissionErrors(sym: MathSymbol): string[] {
  const errors = validateSymbol(sym);
  if (errors.length > 0) return errors;
  if (entries.has(sym.name)) return [`الرمز \\${sym.name} معرَّف مسبقًا`];
  if (!sym.override && isKatexCommand(sym.name)) {
    return [`\\${sym.name} أمر موجود في KaTeX؛ استخدم override: true لاستبداله`];
  }
  return [];
}

export interface DefineResult {
  ok: boolean;
  errors: string[];
}

/**
 * Register a symbol. Rejected if invalid, if the name is already registered
 * (re-defining needs `removeSymbol` first), or if it would shadow a KaTeX
 * built-in without `override: true`.
 */
export function defineSymbol(sym: MathSymbol, source: SymbolSource = 'builtin'): DefineResult {
  const errors = admissionErrors(sym);
  if (errors.length > 0) return { ok: false, errors };
  entries.set(sym.name, { symbol: sym, source });
  changed();
  return { ok: true, errors: [] };
}

/** Register many symbols with a single change notification. Returns errors per rejected name. */
export function defineSymbols(syms: MathSymbol[], source: SymbolSource = 'builtin'): Record<string, string[]> {
  const rejected: Record<string, string[]> = {};
  for (const sym of syms) {
    const errors = admissionErrors(sym);
    if (errors.length > 0) rejected[String((sym as MathSymbol)?.name ?? '?')] = errors;
    else entries.set(sym.name, { symbol: sym, source });
  }
  changed();
  return rejected;
}

export function removeSymbol(name: string): boolean {
  const had = entries.delete(name);
  if (had) changed();
  return had;
}

/** Drop every user (workspace) symbol, e.g. before loading another workspace. */
export function clearUserSymbols(): void {
  let any = false;
  for (const [name, e] of entries) {
    if (e.source === 'user') {
      entries.delete(name);
      any = true;
    }
  }
  if (any) changed();
}

export function getSymbol(name: string): MathSymbol | undefined {
  return entries.get(name)?.symbol;
}

export function getSymbolSource(name: string): SymbolSource | undefined {
  return entries.get(name)?.source;
}

export function getSymbols(category?: SymbolCategory): MathSymbol[] {
  const all = [...entries.values()].map((e) => e.symbol);
  return category ? all.filter((s) => s.category === category) : all;
}

/** Search by name, Arabic label and keywords; Arabic matching ignores diacritics and letter variants. */
export function searchSymbols(query: string): MathSymbol[] {
  const q = normalizeArabic(query.trim().toLowerCase().replace(/^\\/, ''));
  if (!q) return getSymbols();
  return getSymbols().filter((s) =>
    [s.name, s.labelAr, ...s.keywords].some((t) => normalizeArabic(t.toLowerCase()).includes(q)),
  );
}

/** Macro table for KaTeX: { "\\jaa": "\\operatorname{\\text{جا}}", … }. */
export function toKatexMacros(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { symbol } of entries.values()) out[`\\${symbol.name}`] = katexExpansion(symbol);
  return out;
}

/** For tests: forget everything. */
export function resetRegistry(): void {
  entries.clear();
  changed();
}
