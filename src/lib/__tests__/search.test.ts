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

  it('folds Arabic presentation forms and ligatures', () => {
    expect(normalizeArabic('ﻻ')).toBe('لا');
    expect(normalizeArabic('ﻣﺪﺭﺳﺔ')).toBe('مدرسه');
    expect(normalizeArabic('ﺇﺳﻼﻡ')).toBe('اسلام');
  });
});
