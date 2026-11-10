import { describe, expect, it } from 'vitest';
import { convertToArabicWords } from '$lib/tafqit';

describe('test harness', () => {
  it('resolves the $lib alias and runs TypeScript', () => {
    expect(convertToArabicWords(1)).toBe('واحد');
  });
});
