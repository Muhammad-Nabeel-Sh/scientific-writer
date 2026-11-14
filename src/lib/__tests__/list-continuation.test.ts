import { describe, it, expect } from 'vitest';
import { continueList } from '$lib/list-continuation';

/** Apply Enter at the `|` in `text` and return the result with `|` at the caret (or null). */
function enter(text: string): string | null {
  const pos = text.indexOf('|');
  const value = text.replace('|', '');
  const r = continueList(value, pos, pos);
  return r ? r.value.slice(0, r.cursor) + '|' + r.value.slice(r.cursor) : null;
}

describe('continueList', () => {
  it('continues bullet lists', () => {
    expect(enter('- أول|')).toBe('- أول\n- |');
    expect(enter('* one|')).toBe('* one\n* |');
    expect(enter('  + nested|\nafter')).toBe('  + nested\n  + |\nafter');
  });

  it('increments numbered lists, keeping the digit style and delimiter', () => {
    expect(enter('1. one|')).toBe('1. one\n2. |');
    expect(enter('9) nine|')).toBe('9) nine\n10) |');
    expect(enter('١. البند الأول|')).toBe('١. البند الأول\n٢. |');
    expect(enter('٩. تسعة|')).toBe('٩. تسعة\n١٠. |');
    expect(enter('۳. فارسی|')).toBe('۳. فارسی\n۴. |');
  });

  it('continues task lists with an unchecked box', () => {
    expect(enter('- [x] done|')).toBe('- [x] done\n- [ ] |');
  });

  it('moves the text after the caret to the new item', () => {
    expect(enter('- ab|cd')).toBe('- ab\n- |cd');
  });

  it('ends the list on an empty item', () => {
    expect(enter('- one\n- |')).toBe('- one\n|');
    expect(enter('1. one\n2. |\nnext')).toBe('1. one\n|\nnext');
    expect(enter('> - quoted\n> - |')).toBe('> - quoted\n> |');
  });

  it('continues inside blockquotes', () => {
    expect(enter('> - quoted|')).toBe('> - quoted\n> - |');
  });

  it('does nothing outside lists, in code fences or with the caret in the marker', () => {
    expect(enter('plain text|')).toBeNull();
    expect(enter('```\n- not a list|\n```')).toBeNull();
    expect(enter('-| item')).toBeNull();
    expect(enter('-not a list|')).toBeNull();
  });
});
