/**
 * The custom-symbol editor's form state ↔ a MathSymbol. Kept pure so it can
 * be tested, and so the dialog's reactive statement can list every field it
 * depends on (Svelte only re-runs `$:` statements for variables written in
 * the statement itself — not for ones read inside a called function).
 */
import type { GlyphAtom, MathSymbol, SymbolCategory } from './registry';

export interface SymbolForm {
  name: string;
  labelAr: string;
  /** Comma-separated (Arabic ، or Latin ,). */
  keywords: string;
  category: SymbolCategory;
  kind: 'macro' | 'glyph';
  macroBody: string;
  arity: 0 | 1 | 2;
  glyphChar: string;
  glyphFont: string;
  glyphAtom: GlyphAtom;
  /** Optional: falls back to the macro body (or the glyph character). */
  latexBody: string;
}

export function emptySymbolForm(name = ''): SymbolForm {
  return {
    name,
    labelAr: '',
    keywords: '',
    category: 'misc',
    kind: 'macro',
    macroBody: '',
    arity: 0,
    glyphChar: '',
    glyphFont: 'arabicmath',
    glyphAtom: 'mathord',
    latexBody: '',
  };
}

export function formFromSymbol(sym: MathSymbol): SymbolForm {
  const k = sym.katex;
  return {
    name: sym.name,
    labelAr: sym.labelAr,
    keywords: sym.keywords.join('، '),
    category: sym.category,
    kind: k.kind,
    macroBody: k.kind === 'macro' ? k.body : '',
    arity: sym.arity ?? 0,
    glyphChar: k.kind === 'glyph' ? k.char : '',
    glyphFont: k.kind === 'glyph' ? k.font : 'arabicmath',
    glyphAtom: k.kind === 'glyph' ? k.atom : 'mathord',
    // Show the stored LaTeX only when it differs from the default fallback.
    latexBody: sym.latex.body === (k.kind === 'macro' ? k.body : k.char) ? '' : sym.latex.body,
  };
}

export function formToSymbol(f: SymbolForm): MathSymbol {
  const macro = f.kind === 'macro';
  const fallbackLatex = macro ? f.macroBody.trim() : f.glyphChar;
  return {
    name: f.name.trim(),
    category: f.category,
    labelAr: f.labelAr.trim(),
    keywords: f.keywords.split(/[،,]/).map((k) => k.trim()).filter(Boolean),
    arity: macro ? Number(f.arity) as 0 | 1 | 2 : 0,
    katex: macro
      ? { kind: 'macro', body: f.macroBody.trim() }
      : { kind: 'glyph', char: f.glyphChar.trim(), font: f.glyphFont.trim(), atom: f.glyphAtom },
    latex: { body: f.latexBody.trim() || fallbackLatex },
  };
}
