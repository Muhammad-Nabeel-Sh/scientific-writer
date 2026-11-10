import { describe, expect, it } from 'vitest';
import { addStats, computeStats } from '$lib/stats';

describe('computeStats', () => {
  it('returns zeroes for empty and whitespace-only text', () => {
    const zero = { words: 0, characters: 0, paragraphs: 0, headings: 0, images: 0, figures: 0, tables: 0 };
    expect(computeStats('')).toEqual(zero);
    expect(computeStats('   \n\t\n')).toEqual(zero);
  });

  it('counts Arabic words and letters, stripping diacritics', () => {
    expect(computeStats('مرحبا بالعالم')).toMatchObject({ words: 2, characters: 12, paragraphs: 1 });
    expect(computeStats('كَتَبَ الطالبُ الدرسَ')).toMatchObject({ words: 3, characters: 14 });
  });

  it('counts Latin words and letters in mixed Arabic/English text', () => {
    expect(computeStats('Hello world')).toMatchObject({ words: 2, characters: 10 });
    expect(computeStats('مرحبا hello world')).toMatchObject({ words: 3, characters: 15 });
  });

  it('ignores code and math when counting prose', () => {
    expect(computeStats('`const x = 1` نص')).toMatchObject({ words: 1, characters: 2 });
    expect(computeStats('$$\ns_1^2\n$$')).toMatchObject({ words: 0, characters: 0 });
  });

  it('counts paragraphs and headings', () => {
    expect(computeStats('# عنوان\n\nنص')).toMatchObject({ paragraphs: 2, headings: 1 });
    expect(computeStats('## أ\n### ب')).toMatchObject({ headings: 2 });
    expect(computeStats('#بدون مسافة')).toMatchObject({ headings: 0 });
    expect(computeStats('# واحد\n\n## اثنان\n\nنص')).toMatchObject({ headings: 2, paragraphs: 3 });
  });

  it('counts images as both images and figures', () => {
    expect(computeStats('![صورة](x.png)')).toMatchObject({ images: 1, figures: 1 });
    expect(computeStats('![أ](a.png)\n![ب](b.png)')).toMatchObject({ images: 2, figures: 2 });
    expect(computeStats('نص بدون صور')).toMatchObject({ images: 0, figures: 0 });
  });

  it('counts contiguous table blocks, not individual rows', () => {
    const oneTable = '| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |';
    expect(computeStats(oneTable)).toMatchObject({ tables: 1 });
    const twoTables = '| a |\n|---|\n| 1 |\n\n| b |\n|---|\n| 2 |';
    expect(computeStats(twoTables)).toMatchObject({ tables: 2 });
    expect(computeStats('نص فقط')).toMatchObject({ tables: 0 });
  });

  it('counts multi-line paragraphs separated by blank lines', () => {
    expect(computeStats('سطر1\nسطر2\n\nفقرة2')).toMatchObject({ paragraphs: 2, words: 3 });
  });
});

describe('addStats', () => {
  it('adds each field independently', () => {
    const a = computeStats('مرحبا');
    const b = computeStats('Hello');
    expect(addStats(a, b)).toEqual({
      words: a.words + b.words,
      characters: a.characters + b.characters,
      paragraphs: a.paragraphs + b.paragraphs,
      headings: a.headings + b.headings,
      images: a.images + b.images,
      figures: a.figures + b.figures,
      tables: a.tables + b.tables,
    });
  });

  it('returns zeroes when adding two empty stats', () => {
    expect(addStats(computeStats(''), computeStats(''))).toEqual(computeStats(''));
  });
});
