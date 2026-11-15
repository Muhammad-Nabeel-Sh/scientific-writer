import { describe, expect, it } from 'vitest';
import { frontMatterLanguage, parseFrontMatter } from '$lib/frontmatter';

describe('parseFrontMatter', () => {
  it('returns the body unchanged when there is no front-matter', () => {
    const r = parseFrontMatter('# Title\n\nText');
    expect(r.hasFrontMatter).toBe(false);
    expect(r.meta).toEqual({});
    expect(r.body).toBe('# Title\n\nText');
  });

  it('parses flat key: value metadata and strips it from the body', () => {
    const r = parseFrontMatter('---\nlang: ar\ntitle: "اختبار"\nauthor: \'محمد\'\n---\n\n# عنوان\n\nنص');
    expect(r.hasFrontMatter).toBe(true);
    expect(r.meta).toEqual({ lang: 'ar', title: 'اختبار', author: 'محمد' });
    expect(r.body).toBe('# عنوان\n\nنص');
    expect(r.bodyLineOffset).toBe(6);
  });

  it('reports no offset when there is no front-matter', () => {
    expect(parseFrontMatter('# Title').bodyLineOffset).toBe(0);
    expect(parseFrontMatter('---\nlang: ar\n\nText').bodyLineOffset).toBe(0);
  });

  it('handles CRLF, a BOM, comments and blank values', () => {
    const r = parseFrontMatter('\uFEFF---\r\n# comment\r\nlang: en\r\nempty:\r\n---\r\nText');
    expect(r.meta).toEqual({ lang: 'en', empty: '' });
    expect(r.body).toBe('Text');
  });

  it('does not strip an unclosed block', () => {
    const text = '---\nlang: ar\n\nText';
    const r = parseFrontMatter(text);
    expect(r.hasFrontMatter).toBe(false);
    expect(r.body).toBe(text);
  });

  it('does not treat a horizontal rule block as metadata', () => {
    const text = '---\nنص عادي\n---\n\nبقية';
    const r = parseFrontMatter(text);
    expect(r.hasFrontMatter).toBe(false);
    expect(r.body).toBe(text);
  });

  it('extracts only valid document languages', () => {
    expect(frontMatterLanguage({ lang: 'ar' })).toBe('ar');
    expect(frontMatterLanguage({ lang: 'en' })).toBe('en');
    expect(frontMatterLanguage({ lang: 'fr' })).toBeUndefined();
    expect(frontMatterLanguage({})).toBeUndefined();
  });
});
