import { describe, expect, it } from 'vitest';
import { analyzeOutline } from '$lib/markdown';

describe('analyzeOutline', () => {
  it('returns headings with levels, source lines and character offsets', () => {
    const md = '# الأول\n\nنص\n\n## الثاني';
    expect(analyzeOutline(md)).toEqual([
      {
        id: 'h-0',
        level: 1,
        text: 'الأول',
        lineIndex: 0,
        charOffset: 0,
      },
      {
        id: 'h-4',
        level: 2,
        text: 'الثاني',
        lineIndex: 4,
        charOffset: md.indexOf('## الثاني'),
      },
    ]);
  });

  it('includes headings nested inside classical containers', () => {
    const md = ':::page\n# داخل الصفحة\n\n## قسم\n:::';
    expect(analyzeOutline(md).map((h) => [h.level, h.text, h.lineIndex])).toEqual([
      [1, 'داخل الصفحة', 1],
      [2, 'قسم', 3],
    ]);
  });

  it('includes headings inside blockquotes and list items', () => {
    const md = '> # اقتباس\n\n- # قائمة';
    expect(analyzeOutline(md).map((h) => h.text)).toEqual(['اقتباس', 'قائمة']);
  });

  it('ignores # lines inside backtick and tilde fences', () => {
    const md = '```\n# داخل كود\n```\n\n~~~\n## داخل كود أيضاً\n~~~\n\n# عنوان حقيقي';
    expect(analyzeOutline(md).map((h) => h.text)).toEqual(['عنوان حقيقي']);
  });

  it('supports setext headings', () => {
    const md = 'عنوان\n=====\n\nفرعي\n-----';
    expect(analyzeOutline(md).map((h) => [h.level, h.text])).toEqual([
      [1, 'عنوان'],
      [2, 'فرعي'],
    ]);
  });

  it('returns an empty list when there are no headings', () => {
    expect(analyzeOutline('')).toEqual([]);
    expect(analyzeOutline('نص فقط\nبدون عناوین')).toEqual([]);
  });
});
