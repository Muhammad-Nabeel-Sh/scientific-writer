import { describe, expect, it } from 'vitest';
import { countStretchablePositions, insertTatweel } from '$lib/kashida';

const TATWEEL = '\u0640';

function tatweelCount(s: string): number {
  return [...s].filter((c) => c === TATWEEL).length;
}

describe('countStretchablePositions', () => {
  it('counts connecting letters that are followed by another character', () => {
    expect(countStretchablePositions('ببب')).toBe(2);
    expect(countStretchablePositions('سلام')).toBe(2);
    expect(countStretchablePositions('كتاب')).toBe(2);
    expect(countStretchablePositions('مدرسة')).toBe(2);
  });

  it('does not count final-only letters', () => {
    expect(countStretchablePositions('ا')).toBe(0);
    expect(countStretchablePositions('د')).toBe(0);
    expect(countStretchablePositions('و')).toBe(0);
    expect(countStretchablePositions('ابد')).toBe(1);
  });

  it('returns zero for empty or single-stretchable-letter strings', () => {
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

  it('returns the original text when there is nowhere to stretch', () => {
    expect(insertTatweel('لا', 1)).toBe('لا');
    expect(insertTatweel('', 1)).toBe('');
    expect(insertTatweel('ا', 1)).toBe('ا');
  });

  it('does not insert more tatweels than requested', () => {
    expect(tatweelCount(insertTatweel('كتاب', 3))).toBeLessThanOrEqual(3);
    expect(tatweelCount(insertTatweel('سلام', 10))).toBeLessThanOrEqual(10);
  });

  // Found during P0.4: once the requested count is reached the loop stops and
  // never copies the remaining leading characters. "سلام" loses its initial س,
  // so preview text is silently truncated whenever kashida is applied.
  it.todo('insertTatweel should preserve every original character');

  // Found during P0.4: a stretchable letter followed by a space can receive a
  // tatweel on the wrong side of the word boundary.
  it.todo('insertTatweel should not insert tatweel across a word boundary');
});
