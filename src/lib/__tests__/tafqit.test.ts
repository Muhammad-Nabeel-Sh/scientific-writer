import { describe, expect, it } from 'vitest';
import { convertToArabicWords } from '$lib/tafqit';

describe('convertToArabicWords', () => {
  it('converts zero and small integers', () => {
    expect(convertToArabicWords(0)).toBe('صفر');
    expect(convertToArabicWords(1)).toBe('واحد');
    expect(convertToArabicWords(2)).toBe('اثنان');
    expect(convertToArabicWords(11)).toBe('أحد عشر');
    expect(convertToArabicWords(19)).toBe('تسعة عشر');
  });

  it('converts tens and compounds', () => {
    expect(convertToArabicWords(20)).toBe('عشرون');
    expect(convertToArabicWords(21)).toBe('واحد وعشرون');
    expect(convertToArabicWords(99)).toBe('تسعة وتسعون');
  });

  it('converts hundreds', () => {
    expect(convertToArabicWords(100)).toBe('مائة');
    expect(convertToArabicWords(101)).toBe('مائة وواحد');
    expect(convertToArabicWords(200)).toBe('مئتان');
    expect(convertToArabicWords(999)).toBe('تسعمائة وتسعة وتسعون');
  });

  it('converts thousands and millions with correct dual/plural forms', () => {
    expect(convertToArabicWords(1000)).toBe('ألف');
    expect(convertToArabicWords(2000)).toBe('ألفان');
    expect(convertToArabicWords(3000)).toBe('ثلاثة آلاف');
    expect(convertToArabicWords(1_000_000)).toBe('مليون');
    expect(convertToArabicWords(2_000_000)).toBe('مليونان');
    expect(convertToArabicWords(1_000_000_000)).toBe('مليار');
  });

  it('converts negative integers', () => {
    expect(convertToArabicWords(-5)).toBe('سالب خمسة');
    expect(convertToArabicWords(-100)).toBe('سالب مائة');
  });

  it('converts fractions, including leading zeros in the fractional part', () => {
    expect(convertToArabicWords(3.14)).toBe('ثلاثة فاصلة أربعة عشر');
    expect(convertToArabicWords(0.5)).toBe('فاصلة خمسة');
    expect(convertToArabicWords(0.05)).toBe('فاصلة صفر خمسة');
    expect(convertToArabicWords(1.05)).toBe('واحد فاصلة صفر خمسة');
  });

  it('accepts strings, Arabic-Indic digits and comma decimals', () => {
    expect(convertToArabicWords('١٢٣')).toBe('مائة وثلاثة وعشرون');
    expect(convertToArabicWords('3,5')).toBe('ثلاثة فاصلة خمسة');
    expect(convertToArabicWords(' 42 ')).toBe('اثنان وأربعون');
  });

  it('returns an empty string for non-numeric input', () => {
    expect(convertToArabicWords('')).toBe('');
    expect(convertToArabicWords('abc')).toBe('');
    expect(convertToArabicWords(Number.NaN)).toBe('');
    expect(convertToArabicWords(Number.POSITIVE_INFINITY)).toBe('');
  });

  it('keeps the sign of negative fractions', () => {
    expect(convertToArabicWords(-0.5)).toBe('سالب فاصلة خمسة');
    expect(convertToArabicWords('-3.14')).toBe('سالب ثلاثة فاصلة أربعة عشر');
    expect(convertToArabicWords('-0.05')).toBe('سالب فاصلة صفر خمسة');
  });

  it('names large groups correctly (مليار / تريليون)', () => {
    expect(convertToArabicWords(1e9)).toBe('مليار');
    expect(convertToArabicWords(1e12)).toBe('تريليون');
    expect(convertToArabicWords(2e12)).toBe('تريليونان');
    expect(convertToArabicWords(3e12)).toBe('ثلاثة تريليونات');
  });
});
