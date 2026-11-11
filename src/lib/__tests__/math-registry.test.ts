import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  renderMath,
  defineSymbol,
  defineSymbols,
  getSymbol,
  getSymbols,
  searchSymbols,
  toKatexMacros,
  validateSymbol,
  resetRegistry,
  removeSymbol,
  clearUserSymbols,
  mathRegistryVersion,
  applyUserSymbols,
  parseUserSymbolsFile,
  serializeUserSymbols,
  isKatexCommand,
  ensureBuiltinSymbols,
  type MathSymbol,
  type MathIssue,
} from '$lib/math';
import { renderDocument } from '$lib/markdown';

function macroSym(name: string, body: string, extra: Partial<MathSymbol> = {}): MathSymbol {
  return {
    name,
    category: 'misc',
    labelAr: 'رمز',
    keywords: [],
    katex: { kind: 'macro', body },
    latex: { body },
    ...extra,
  };
}

function glyphSym(name: string, char: string): MathSymbol {
  return {
    name,
    category: 'arabic-letter',
    labelAr: 'حرف',
    keywords: ['alef'],
    unicode: char,
    katex: { kind: 'glyph', char, font: 'arabicmath', atom: 'mathord' },
    latex: { body: char },
  };
}

function issues(tex: string): MathIssue[] {
  const out: MathIssue[] = [];
  renderMath(tex, { display: false, onIssue: (i) => out.push(i) });
  return out;
}

beforeEach(() => resetRegistry());

describe('validateSymbol', () => {
  it('accepts a well-formed macro and glyph symbol', () => {
    expect(validateSymbol(macroSym('foo', 'x+1'))).toEqual([]);
    expect(validateSymbol(glyphSym('arAlef', '\u{1EE00}'))).toEqual([]);
  });

  it('rejects bad names, categories, empty bodies, missing args and self-reference', () => {
    expect(validateSymbol(macroSym('foo1', 'x'))).toHaveLength(1);
    expect(validateSymbol(macroSym('', 'x'))).toHaveLength(1);
    expect(validateSymbol({ ...macroSym('foo', 'x'), category: 'nope' })).toHaveLength(1);
    expect(validateSymbol(macroSym('foo', '  '))).toContain('نص الماكرو فارغ');
    expect(validateSymbol(macroSym('foo', 'x', { arity: 1 }))).toHaveLength(1);
    expect(validateSymbol(macroSym('foo', '\\foo+1'))).toHaveLength(1);
    expect(validateSymbol({ ...macroSym('foo', 'x'), latex: { body: '' } })).toHaveLength(1);
    expect(validateSymbol(null)).toHaveLength(1);
  });

  it('rejects glyphs with TeX specials, bad fonts or atoms', () => {
    expect(validateSymbol(glyphSym('a', '\\x'))).toHaveLength(1);
    expect(validateSymbol({ ...glyphSym('a', 'ا'), katex: { kind: 'glyph', char: 'ا', font: 'Bad Font', atom: 'mathord' } })).toHaveLength(1);
    expect(validateSymbol({ ...glyphSym('a', 'ا'), katex: { kind: 'glyph', char: 'ا', font: 'x', atom: 'mathfoo' } } as never)).toHaveLength(1);
  });
});

describe('registry', () => {
  it('rejects duplicates and KaTeX built-ins unless override', () => {
    expect(defineSymbol(macroSym('foo', 'x')).ok).toBe(true);
    expect(defineSymbol(macroSym('foo', 'y')).ok).toBe(false);
    expect(isKatexCommand('frac')).toBe(true);
    expect(isKatexCommand('surelynotacommand')).toBe(false);
    expect(defineSymbol(macroSym('alpha', 'a')).ok).toBe(false);
    expect(defineSymbol(macroSym('alpha', 'a', { override: true })).ok).toBe(true);
  });

  it('macro symbols expand in renderMath, with arguments', () => {
    expect(issues('\\twice{x}')[0]).toMatchObject({ code: 'undefined-macro', macro: 'twice' });
    defineSymbol(macroSym('twice', '2#1', { arity: 1 }));
    expect(issues('\\twice{x}')).toEqual([]);
    expect(renderMath('\\twice{x}', { display: false })).toContain('<annotation encoding="application/x-tex">\\twice{x}</annotation>');
  });

  it('glyph symbols render as a trusted sw-sym span in the right font class', () => {
    defineSymbol(glyphSym('arAlef', '\u{1EE00}'));
    const html = renderMath('\\arAlef + 1', { display: false });
    expect(html).toContain('class="enclosing sw-sym sw-font-arabicmath"');
    expect(issues('\\arAlef')).toEqual([]);
  });

  it('trusts only sw- classes in \\htmlClass and nothing else', () => {
    expect(renderMath('\\htmlClass{sw-x}{a}', { display: false })).toContain('sw-x');
    const bad = renderMath('\\htmlClass{evil}{a}', { display: false });
    expect(bad).not.toContain('class="enclosing evil"');
    expect(renderMath('\\href{https://e.com}{a}', { display: false })).not.toContain('href="https://e.com"');
  });

  it('searches Arabic labels ignoring diacritics, and English keywords', () => {
    ensureBuiltinSymbols();
    defineSymbols([macroSym('foo', 'x', { labelAr: 'جَيْب', keywords: ['sine'] })]);
    expect(searchSymbols('جيب').map((s) => s.name)).toContain('foo');
    expect(searchSymbols('SINE').map((s) => s.name)).toContain('foo');
    expect(searchSymbols('\\foo').map((s) => s.name)).toEqual(['foo']);
  });

  it('notifies on change and keeps macros in sync', () => {
    const v0 = get(mathRegistryVersion);
    defineSymbol(macroSym('foo', 'x'));
    expect(get(mathRegistryVersion)).toBeGreaterThan(v0);
    expect(toKatexMacros()).toEqual({ '\\foo': 'x' });
    removeSymbol('foo');
    expect(toKatexMacros()).toEqual({});
    expect(issues('\\foo')[0].code).toBe('undefined-macro');
  });
});

describe('workspace symbols (math-symbols.json)', () => {
  it('round-trips and keeps valid entries when some are invalid', () => {
    const text = serializeUserSymbols([macroSym('good', 'g'), macroSym('bad1', 'b')]);
    const parsed = parseUserSymbolsFile(text);
    expect(parsed.symbols.map((s) => s.name)).toEqual(['good']);
    expect(parsed.errors).toHaveLength(1);
  });

  it('rejects malformed files', () => {
    expect(parseUserSymbolsFile('{').errors).toHaveLength(1);
    expect(parseUserSymbolsFile('{"version":1}').errors).toHaveLength(1);
    expect(parseUserSymbolsFile('{"version":9,"symbols":[]}').errors).toHaveLength(1);
  });

  it('applyUserSymbols replaces previous user symbols but keeps built-ins', () => {
    defineSymbol(macroSym('builtinA', 'a'));
    expect(applyUserSymbols(serializeUserSymbols([macroSym('mine', 'm')]))).toEqual([]);
    expect(getSymbol('mine')).toBeDefined();
    applyUserSymbols(serializeUserSymbols([macroSym('other', 'o')]));
    expect(getSymbol('mine')).toBeUndefined();
    expect(getSymbol('other')).toBeDefined();
    expect(getSymbol('builtinA')).toBeDefined();
    applyUserSymbols(null);
    expect(getSymbol('other')).toBeUndefined();
    clearUserSymbols();
    expect(getSymbols().map((s) => s.name)).toEqual(['builtinA']);
  });

  it('a user symbol cannot take a built-in name', () => {
    defineSymbol(macroSym('taken', 'a'));
    const errors = applyUserSymbols(serializeUserSymbols([macroSym('taken', 'b')]));
    expect(errors).toHaveLength(1);
    expect(toKatexMacros()['\\taken']).toBe('a');
  });
});

describe('built-in Arabic functions in documents', () => {
  it('render without warnings and stay LTR math', () => {
    resetRegistry();
    // ensureBuiltinSymbols ran at import; re-register after the reset above
    for (const name of ['jaa', 'nihaya']) expect(getSymbol(name)).toBeUndefined();
    // simulate a fresh app start
    return import('$lib/math/symbols').then(({ BUILTIN_SYMBOL_SETS }) => {
      for (const set of BUILTIN_SYMBOL_SETS) defineSymbols(set);
      const r = renderDocument('$$\n\\nihaya_{x \\to 0} \\frac{\\jaa x}{x} = 1\n$$');
      expect(r.warnings).toEqual([]);
      expect(r.html).toContain('جا');
      expect(r.html).toContain('نها');
    });
  });
});
