import { describe, expect, it } from 'vitest';
import { normalizeArabic } from '$lib/search';

describe('normalizeArabic', () => {
  it('unifies alif variants', () => {
    expect(normalizeArabic('إسلام')).toBe('اسلام');
    expect(normalizeArabic('أحمد')).toBe('احمد');
    expect(normalizeArabic('آمن')).toBe('امن');
    expect(normalizeArabic('ايمان')).toBe('ايمان');
  });

  it('unifies ya, ta marbuta, hamza on ya and hamza on waw', () => {
    expect(normalizeArabic('على')).toBe('علي');
    expect(normalizeArabic('مدرسة')).toBe('مدرسه');
    expect(normalizeArabic('ئ')).toBe('ي');
    expect(normalizeArabic('يؤمن')).toBe('يومن');
  });

  it('strips diacritics, dagger alif and tatweel', () => {
    expect(normalizeArabic('كَتَبَ')).toBe('كتب');
    expect(normalizeArabic('مُحَمَّد')).toBe('محمد');
    expect(normalizeArabic('اللّٰه')).toBe('الله');
    expect(normalizeArabic('كـــتاب')).toBe('كتاب');
    expect(normalizeArabic('إِسْلَام')).toBe('اسلام');
  });

  it('collapses whitespace and trims', () => {
    expect(normalizeArabic('  a   b  ')).toBe('a b');
    expect(normalizeArabic('كلمة    أخرى')).toBe('كلمه اخري');
    expect(normalizeArabic('\n\tكلمة\n')).toBe('كلمه');
  });

  it('leaves empty and Latin-only strings intact (apart from trimming)', () => {
    expect(normalizeArabic('')).toBe('');
    expect(normalizeArabic('   ')).toBe('');
    expect(normalizeArabic('Hello World')).toBe('Hello World');
  });

  // Found during P0.4: Arabic presentation forms (e.g. the lam-alef ligature
  // U+FEFB) are not folded, so text pasted from PDFs may not match search queries.
  it.todo('normalizeArabic should fold Arabic presentation forms such as U+FEFB to their base letters');
});
