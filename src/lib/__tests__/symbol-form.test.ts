import { describe, it, expect } from 'vitest';
import { validateSymbol, getSymbol } from '$lib/math';
import { emptySymbolForm, formFromSymbol, formToSymbol, type SymbolForm } from '$lib/math/symbol-form';

function filled(over: Partial<SymbolForm> = {}): SymbolForm {
  return {
    ...emptySymbolForm('myvec'),
    labelAr: 'متجه',
    keywords: 'متجه، vector',
    macroBody: '\\overrightarrow{#1}',
    arity: 1,
    ...over,
  };
}

describe('symbol editor form', () => {
  it('an empty form is invalid (Save disabled)', () => {
    expect(validateSymbol(formToSymbol(emptySymbolForm()))).not.toEqual([]);
  });

  it('a filled macro form is valid WITHOUT a LaTeX body (falls back to the macro body)', () => {
    const sym = formToSymbol(filled());
    expect(validateSymbol(sym)).toEqual([]);
    expect(sym.latex.body).toBe('\\overrightarrow{#1}');
    expect(sym.keywords).toEqual(['متجه', 'vector']);
    expect(sym.arity).toBe(1);
  });

  it('an explicit LaTeX body wins over the fallback', () => {
    expect(formToSymbol(filled({ latexBody: ' \\vec{#1} ' })).latex.body).toBe('\\vec{#1}');
  });

  it('arity from a <select> may arrive as a string and is normalised', () => {
    const sym = formToSymbol(filled({ arity: '1' as unknown as 1 }));
    expect(sym.arity).toBe(1);
    expect(validateSymbol(sym)).toEqual([]);
  });

  it('glyph forms are valid and use the character for LaTeX', () => {
    const sym = formToSymbol(filled({ kind: 'glyph', glyphChar: '\u{1EE00}', macroBody: '', arity: 0 }));
    expect(validateSymbol(sym)).toEqual([]);
    expect(sym.katex).toEqual({ kind: 'glyph', char: '\u{1EE00}', font: 'arabicmath', atom: 'mathord' });
    expect(sym.latex.body).toBe('\u{1EE00}');
    expect(sym.arity).toBe(0);
  });

  it('formFromSymbol → formToSymbol round-trips an existing symbol (editing)', () => {
    for (const name of ['jaa', 'arDsBeh', 'rsqrt']) {
      const sym = getSymbol(name)!;
      const back = formToSymbol(formFromSymbol(sym));
      expect(back.name).toBe(sym.name);
      expect(back.katex).toEqual(sym.katex);
      expect(back.latex.body).toBe(sym.latex.body);
      expect(back.arity ?? 0).toBe(sym.arity ?? 0);
    }
  });
});
