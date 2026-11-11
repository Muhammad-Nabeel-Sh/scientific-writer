import { describe, expect, it } from 'vitest';
import { KATEX_CATALOG } from '$lib/math/katex-catalog';
import { ensureBuiltinSymbols, searchSymbols } from '$lib/math';

describe('KaTeX catalog', () => {
  it('has well-formed standard categories and entries', () => {
    expect(KATEX_CATALOG.length).toBeGreaterThan(20);
    const names = KATEX_CATALOG.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);

    for (const category of KATEX_CATALOG) {
      expect(category.label).toMatch(/[\u0600-\u06FF]/);
      expect(category.items.length).toBeGreaterThan(0);
      for (const item of category.items) {
        expect(item.latex).toBeTruthy();
        expect(item.preview).toBeTruthy();
        expect(item.code).toBeTruthy();
      }
    }
  });

  it('Arabic function search finds the registry symbols shown by the catalog tab', () => {
    ensureBuiltinSymbols();
    const names = searchSymbols('جيب').map((s) => s.name);
    expect(names).toContain('jaa');
    expect(names).toContain('jataa');
  });
});
