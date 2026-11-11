import { describe, expect, it } from 'vitest';
import {
  arabicGalleryGroups,
  ensureBuiltinSymbols,
  getSymbol,
  renderMath,
  searchSymbols,
  validateSymbol,
  type MathIssue,
} from '$lib/math';
import { ARABIC_NOTATION } from '$lib/math/symbols/arabic-notation';

function issues(tex: string): MathIssue[] {
  const out: MathIssue[] = [];
  renderMath(tex, { display: false, onIssue: (i) => out.push(i) });
  return out;
}

describe('M17 Arabic notation', () => {
  it('all symbols are valid, registered and render without issues', () => {
    ensureBuiltinSymbols();
    for (const symbol of ARABIC_NOTATION) {
      expect(validateSymbol(symbol), symbol.name).toEqual([]);
      expect(getSymbol(symbol.name), symbol.name).toBeDefined();
      const args = '{س}'.repeat(symbol.arity ?? 0);
      expect(issues(`\\${symbol.name}${args}`), symbol.name).toEqual([]);
    }
  });

  it('renders the Arabic abbreviations and the prefix factorial', () => {
    expect(renderMath('\\arGcd(أ, ب)', { display: false })).toContain('ق.م.أ');
    expect(renderMath('\\arLcm(أ, ب)', { display: false })).toContain('م.م.أ');
    expect(renderMath('\\arDet أ', { display: false })).toContain('محدد');
    expect(renderMath('أ \\arMod ن', { display: false })).toMatch(/باقي\s+القسمة/);

    const factorial = renderMath('\\arFact{س}', { display: false });
    expect(factorial).toContain('!');
    expect(factorial).toContain('س');
  });

  it('adds the notation group and interval/set-builder templates to the gallery', () => {
    const groups = arabicGalleryGroups();
    const notation = groups.find((g) => g.id === 'notation');
    expect(notation?.items.map((i) => i.insert)).toEqual(
      expect.arrayContaining(['\\arGcd(أ, ب)', '\\arLcm(أ, ب)', '\\arDet أ', 'أ \\arMod ن']),
    );

    const templates = groups.find((g) => g.id === 'templates');
    const inserts = templates?.items.map((i) => i.insert) ?? [];
    expect(inserts).toEqual(expect.arrayContaining(['(أ ؛ ب)', '[أ ؛ ب]', '(أ ؛ ب]']));
    expect(inserts.some((i) => i.includes('س \\in \\mathbb{R} ،'))).toBe(true);
  });

  it('searches the new symbols by their Arabic labels', () => {
    expect(searchSymbols('محدد').map((s) => s.name)).toContain('arDet');
    expect(searchSymbols('قاسم مشترك').map((s) => s.name)).toContain('arGcd');
    expect(searchSymbols('مضروب').map((s) => s.name)).toContain('arFact');
  });
});
