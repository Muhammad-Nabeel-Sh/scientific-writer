import { describe, expect, it } from 'vitest';
import { countStretchablePositions, insertTatweel } from '$lib/kashida';

const TATWEEL = '\u0640';

function tatweelCount(s: string): number {
  return [...s].filter((c) => c === TATWEEL).length;
}

describe('countStretchablePositions', () => {
  it('counts connecting letters that are followed by a joinable letter', () => {
    expect(countStretchablePositions('ببب')).toBe(2);
    expect(countStretchablePositions('سلام')).toBe(1); // لا ligature is not stretched
    expect(countStretchablePositions('كتاب')).toBe(2);
    expect(countStretchablePositions('مدرسة')).toBe(2);
  });

  it('does not count final-only letters', () => {
    expect(countStretchablePositions('ا')).toBe(0);
    expect(countStretchablePositions('د')).toBe(0);
    expect(countStretchablePositions('و')).toBe(0);
    expect(countStretchablePositions('ابد')).toBe(1);
  });

  it('does not count across spaces or punctuation', () => {
    expect(countStretchablePositions('ب ب')).toBe(0);
    expect(countStretchablePositions('ب،ب')).toBe(0);
    expect(countStretchablePositions('')).toBe(0);
    expect(countStretchablePositions('ب')).toBe(0);
  });
});

describe('insertTatweel', () => {
  it('inserts the requested number of tatweels', () => {
    expect(tatweelCount(insertTatweel('سلام', 1))).toBe(1);
    expect(tatweelCount(insertTatweel('سلام', 2))).toBe(2);
    expect(tatweelCount(insertTatweel('كتاب', 2))).toBe(2);
  });

  it('distributes tatweels across valid joins', () => {
    expect(insertTatweel('كتاب', 2)).toBe('كـتـاب');
    expect(insertTatweel('سلام', 2)).toBe('ســلام');
  });

  it('preserves every original character', () => {
    for (const [word, count] of [['سلام', 1], ['سلام', 2], ['كتاب', 2], ['ب ب', 1], ['لا', 1]] as const) {
      expect(insertTatweel(word, count).replace(/\u0640/g, '')).toBe(word);
    }
  });

  it('does not insert tatweel across a word boundary', () => {
    expect(insertTatweel('ب ب', 1)).toBe('ب ب');
    expect(insertTatweel('سلام عالم', 5)).not.toMatch(/\u0640 /);
    expect(insertTatweel('سلام عالم', 5)).not.toMatch(/ \u0640/);
  });

  it('returns the original text when there is nowhere to stretch', () => {
    expect(insertTatweel('لا', 1)).toBe('لا');
    expect(insertTatweel('', 1)).toBe('');
    expect(insertTatweel('ا', 1)).toBe('ا');
  });

  it('does not insert more tatweels than requested', () => {
    expect(tatweelCount(insertTatweel('كتاب', 3))).toBeLessThanOrEqual(3);
    expect(tatweelCount(insertTatweel('سلام', 10))).toBeLessThanOrEqual(10);
  });
});
