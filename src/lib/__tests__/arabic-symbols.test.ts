import { describe, it, expect } from 'vitest';
import {
  renderMath,
  validateSymbol,
  getSymbol,
  arabicGalleryGroups,
  filterGallery,
  symbolItem,
  ARABIC_TEMPLATES,
  buildEquationSnippet,
  labelError,
  type MathIssue,
} from '$lib/math';
import { ARABIC_ALPHABET } from '$lib/math/symbols/arabic-alphabet';
import { ARABIC_FUNCTIONS } from '$lib/math/symbols/arabic-functions';
import { renderDocument } from '$lib/markdown';

function issues(tex: string, display = false): MathIssue[] {
  const out: MathIssue[] = [];
  renderMath(tex, { display, onIssue: (i) => out.push(i) });
  return out;
}

describe('built-in Arabic symbol sets', () => {
  it('all 143 Arabic math alphabet symbols are valid, unique and registered', () => {
    expect(ARABIC_ALPHABET).toHaveLength(143);
    expect(new Set(ARABIC_ALPHABET.map((s) => s.name)).size).toBe(143);
    for (const s of ARABIC_ALPHABET) {
      expect(validateSymbol(s), s.name).toEqual([]);
      expect(getSymbol(s.name), s.name).toBeDefined();
      const cp = s.unicode!.codePointAt(0)!;
      expect(cp >= 0x1ee00 && cp <= 0x1eeff, s.name).toBe(true);
    }
  });

  it('renders alphabet samples with no issues, in the Katib Math font class', () => {
    for (const name of ['arAlef', 'arInitBeh', 'arTailJeem', 'arLoopAin', 'arDsDal', 'arStretchSeen', 'arOpMeemHah']) {
      expect(issues(`\\${name}`), name).toEqual([]);
      expect(renderMath(`\\${name}`, { display: false }), name).toContain('sw-font-arabicmath');
    }
  });

  it('glyph symbols produce valid MathML tokens (visible in RTL equations)', () => {
    for (const name of ['arDsBeh', 'arAlef', 'arOpMeemHah']) {
      const ch = getSymbol(name)!.unicode!;
      const rtl = renderMath('\\' + name + ' + 1', { display: false, dir: 'rtl' });
      expect(rtl, name).not.toMatch(/<m[ion][^>]*><mtext>/);
      expect(rtl, name).toContain(`>${ch}</m`);
      const ltr = renderMath(`\\${name}`, { display: false });
      expect(ltr, name).not.toMatch(/<m[ion][^>]*><mtext>/);
    }
  });

  it('every Arabic function renders with no issues and shows its Arabic name', () => {
    expect(ARABIC_FUNCTIONS.length).toBeGreaterThanOrEqual(16);
    for (const s of ARABIC_FUNCTIONS) {
      expect(validateSymbol(s), s.name).toEqual([]);
      expect(issues(`\\${s.name} س`), s.name).toEqual([]);
      const ar = /\\text\{([^}]+)\}/.exec(s.katex.kind === 'macro' ? s.katex.body : '')![1];
      expect(renderMath(`\\${s.name} س`, { display: false }), s.name).toContain(ar);
    }
  });

  it('every template renders without problems', () => {
    for (const tpl of ARABIC_TEMPLATES) {
      expect(issues(tpl.preview, true), tpl.id).toEqual([]);
    }
  });
});

describe('mirrored operators, Arabic signs and number sets', () => {
  it('all are valid, registered and render with no issues', async () => {
    const { MIRRORED_OPERATORS, ARABIC_SIGNS, NUMBER_SETS } = await import('$lib/math/symbols/arabic-operators');
    for (const s of [...MIRRORED_OPERATORS, ...ARABIC_SIGNS, ...NUMBER_SETS]) {
      expect(validateSymbol(s), s.name).toEqual([]);
      expect(getSymbol(s.name), s.name).toBeDefined();
      const args = '{س}'.repeat(s.arity ?? 0);
      expect(issues(`\\${s.name}${args}`, true), s.name).toEqual([]);
    }
  });

  it('a mirrored sum behaves like \\sum: large, limits under in display, at the side inline', () => {
    const vis = (tex: string, display: boolean) => {
      const h = renderMath(tex, { display });
      return h.slice(h.indexOf('katex-html'));
    };
    const disp = vis('\\rsum_{ن=1}^{ك}', true);
    expect(disp).toContain('sw-mirror');
    expect(disp).toContain('large-op');
    expect(disp).toContain('op-limits');
    expect(vis('\\rsum_{ن=1}^{ك}', false)).not.toContain('op-limits');
    // integrals keep side limits even in display
    expect(vis('\\rint_0^1', true)).not.toContain('op-limits');
    expect(vis('\\rint_0^1', true)).toContain('large-op');
  });

  it('a mirrored radical flips the sign but flips its content back', () => {
    const h = renderMath('\\rsqrt{س+1}', { display: false });
    const v = h.slice(h.indexOf('katex-html'));
    expect(v.match(/sw-mirror/g)).toHaveLength(2);
    expect(renderMath('\\rroot{3}{س}', { display: false }).match(/sw-mirror/g)!.length).toBe(3);
  });

  it('in RTL equations the mirrored operators carry no CSS flip (rtlm mirrors them)', () => {
    expect(renderMath('\\rsum_{ن=1}^{ك} + \\rint', { display: true, dir: 'rtl' })).not.toContain('sw-mirror');
  });

  it('number sets use the double-struck Arabic letters', () => {
    expect(renderMath('\\arReals', { display: false })).toContain(String.fromCodePoint(0x1eea7)); // DS HAH
    expect(renderMath('\\arIntegers', { display: false })).toContain(String.fromCodePoint(0x1eeb1)); // DS SAD
  });

  it('gallery shows the new groups after the functions', () => {
    const ids = arabicGalleryGroups().map((g) => g.id);
    expect(ids.slice(0, 5)).toEqual(['templates', 'functions', 'mirrored', 'number-sets', 'signs']);
    expect(ids).not.toContain('others');
    const names = (q: string) => filterGallery(arabicGalleryGroups(), q).flatMap((g) => g.items.map((i) => i.id));
    expect(names('مجموع معكوس')).toContain('sym-rsum');
    expect(names('حقيقية')).toContain('sym-arReals');
    expect(names('٪')).toContain('sym-arPercent');
  });
});

describe('gallery data', () => {
  it('groups templates, functions and each letter variant', () => {
    const ids = arabicGalleryGroups().map((g) => g.id);
    expect(ids.slice(0, 2)).toEqual(['templates', 'functions']);
    expect(ids.indexOf('letters-isolated')).toBeGreaterThan(ids.indexOf('signs'));
    expect(ids).toEqual(expect.arrayContaining([
      'letters-initial', 'letters-tailed', 'letters-stretched', 'letters-looped',
      'letters-double-struck', 'letters-dotless', 'letters-operator',
    ]));
    const total = arabicGalleryGroups()
      .filter((g) => g.id.startsWith('letters-'))
      .reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(143);
  });

  it('search finds by Arabic (diacritic-insensitive), English and macro name', () => {
    const groups = arabicGalleryGroups();
    const names = (q: string) => filterGallery(groups, q).flatMap((g) => g.items.map((i) => i.id));
    expect(names('جيب')).toContain('sym-jaa');
    expect(names('جَيْب')).toContain('sym-jaa');
    expect(names('sinh')).toContain('sym-jaaz');
    expect(names('\\arDsBeh')).toEqual(['sym-arDsBeh']);
    expect(names('مصفوفة')).toContain('tpl-matrix');
    expect(filterGallery(groups, 'zzzz')).toEqual([]);
  });

  it('inserts a trailing space after argument-less macros', () => {
    expect(symbolItem(getSymbol('jaa')!).insert).toBe('\\jaa ');
    expect(symbolItem(getSymbol('nihaya')!).preview).toBe('\\nihaya_{س \\to 0}');
  });
});

describe('equation snippet options', () => {
  it('display LTR / RTL, with and without a label', () => {
    expect(buildEquationSnippet({ tex: ' x^2 ', display: true, dir: 'ltr' })).toBe('\n$$\nx^2\n$$\n');
    expect(buildEquationSnippet({ tex: 'س', display: true, dir: 'rtl', label: 'سرعة' })).toBe('\n$$[rtl]\nس\n$$ {#eq:سرعة}\n');
  });

  it('inline ignores direction and label', () => {
    expect(buildEquationSnippet({ tex: 'x', display: false, dir: 'rtl', label: 'a' })).toBe('$x$');
  });

  it('validates labels', () => {
    expect(labelError('')).toBeNull();
    expect(labelError('energy-1')).toBeNull();
    expect(labelError('two words')).not.toBeNull();
    expect(labelError('a{b')).not.toBeNull();
    expect(buildEquationSnippet({ tex: 'x', display: true, dir: 'ltr', label: 'bad label' })).toBe('\n$$\nx\n$$\n');
  });

  it('round-trips through the renderer: RTL + label are honoured', () => {
    const md = buildEquationSnippet({ tex: '\\jaa س = 1', display: true, dir: 'rtl', label: 'eqA' }) + '\n[ref:eq:eqA]';
    const r = renderDocument(md);
    expect(r.equations).toEqual([expect.objectContaining({ id: 'eq:eqA', number: 1 })]);
    expect(r.html).toContain('<math dir="rtl"');
    expect(r.html).toContain('class="eq-ref">(1)</a>');
    expect(r.warnings).toEqual([]);
  });
});
