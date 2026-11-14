import { describe, it, expect } from 'vitest';
import { renderDocument } from '$lib/markdown';

const arabicDoc = [
  'هذه فقرة عربية تشير إلى المعادلة [ref:eq:a] وإلى حاشية[^1].',
  '',
  '$$',
  'x^2',
  '$$ {#eq:a}',
  '',
  '1. البند الأول',
  '2. البند الثاني',
  '',
  '::: نظرية',
  'نص النظرية.',
  ':::',
  '',
  '[^1]: نص الحاشية.',
].join('\n');

describe('generated numbers follow the document digit style', () => {
  it('Arabic document (auto): Arabic-Indic equation numbers, refs, lists, blocks, footnotes', () => {
    const { html } = renderDocument(arabicDoc);
    expect(html).toContain('<figcaption class="eq-number">(١)</figcaption>');
    expect(html).toMatch(/class="eq-ref"[^>]*>\(١\)</);
    expect(html).toMatch(/<ol dir="rtl" class="sw-num-ai">/);
    expect(html).toContain('<span class="block-label">نظرية ١</span>');
    expect(html).toMatch(/<sup class="footnote-ref"[^>]*><a [^>]*>١<\/a>/);
    expect(html).toContain('<ol class="footnotes-list sw-num-ai">');
  });

  it('English document (auto) keeps Western digits even with Arabic in math', () => {
    const { html } = renderDocument('Some English text about $\\arReals$ and more words here.\n\n$$\nس^2\n$$\n\n1. one\n2. two');
    expect(html).toContain('<figcaption class="eq-number">(1)</figcaption>');
    expect(html).not.toContain('sw-num-ai');
  });

  it("'western' forces Western digits in an Arabic document", () => {
    const { html } = renderDocument(arabicDoc, { digitStyle: 'western' });
    expect(html).toContain('<figcaption class="eq-number">(1)</figcaption>');
    expect(html).not.toContain('sw-num-ai');
  });

  it("'eastern' forces Arabic-Indic digits in an English document", () => {
    const { html } = renderDocument('Text.\n\n$$\nx\n$$', { digitStyle: 'eastern' });
    expect(html).toContain('<figcaption class="eq-number">(١)</figcaption>');
  });
});
