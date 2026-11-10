import { describe, expect, it } from 'vitest';
import {
  formatGregorian,
  formatGregorianLong,
  formatGregorianShort,
  formatHijriLong,
  formatHijriShort,
  getTodayHijri,
  gregMonths,
  hijriMonths,
  isValidHijriDate,
  toGregorian,
  toHijri,
} from '$lib/hijri';

describe('hijri calendar', () => {
  it('converts 1 Muharram 1445 (Gregorian → Hijri)', () => {
    expect(toHijri(new Date(2023, 6, 19))).toEqual({
      year: 1445,
      month: 1,
      day: 1,
      monthName: 'محرم',
    });
  });

  it('converts 1 Ramadan 1445 (Gregorian → Hijri)', () => {
    expect(toHijri(new Date(2024, 2, 11))).toEqual({
      year: 1445,
      month: 9,
      day: 1,
      monthName: 'رمضان',
    });
  });

  it('returns a local-midnight Date from toGregorian', () => {
    const d = toGregorian(1445, 1, 1);
    expect(d).toBeInstanceOf(Date);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });

  // Found during P0.4: @umalqura/core returns a 0-based Gregorian month
  // (July = 6), but toGregorian() calls `new Date(gy, gm - 1, gd)`, subtracting
  // a month that was already zero-based. Every Hijri → Gregorian conversion is
  // therefore one month early (e.g. 1 Muharram 1445 → 19 June 2023, not July).
  it.todo('toGregorian(1445, 1, 1) should be 19 July 2023, not 19 June 2023');

  it('converts 1 Muharram 1446 (Gregorian → Hijri)', () => {
    expect(toHijri(new Date(2024, 6, 7))).toEqual({
      year: 1446,
      month: 1,
      day: 1,
      monthName: 'محرم',
    });
  });

  it('formats Gregorian dates with Arabic names', () => {
    const d = new Date(2024, 0, 1);
    expect(formatGregorian(d)).toEqual({
      year: 2024,
      month: 1,
      day: 1,
      monthName: 'يناير',
      dayName: 'الإثنين',
    });
    expect(formatGregorianLong(d)).toBe('الإثنين 1 يناير 2024');
    expect(formatGregorianShort(d)).toBe('2024/01/01');
  });

  it('formats Hijri dates in long and short forms', () => {
    const d = new Date(2023, 6, 19);
    expect(formatHijriLong(d)).toBe('الأربعاء، ١ محرم ١٤٤٥');
    expect(formatHijriShort(d)).toBe('١٤٤٥/٠١/٠١');
  });

  it('validates Hijri dates and rejects out-of-range values', () => {
    expect(isValidHijriDate(1445, 1, 1)).toBe(true);
    expect(isValidHijriDate(1445, 12, 30)).toBe(true);
    expect(isValidHijriDate(1445, 13, 1)).toBe(false);
    expect(isValidHijriDate(1445, 0, 1)).toBe(false);
    expect(isValidHijriDate(1445, 1, 31)).toBe(false);
    expect(isValidHijriDate(1200, 1, 1)).toBe(false);
  });

  it('returns today as a valid Hijri date and exposes month lists', () => {
    const today = getTodayHijri();
    expect(today.year).toBeGreaterThan(1400);
    expect(today.month).toBeGreaterThanOrEqual(1);
    expect(today.month).toBeLessThanOrEqual(12);
    expect(hijriMonths).toHaveLength(12);
    expect(gregMonths).toHaveLength(12);
    expect(today.monthName).toBe(hijriMonths[today.month - 1]);
  });
});
