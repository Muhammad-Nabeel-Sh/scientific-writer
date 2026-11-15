import { describe, expect, it } from 'vitest';
import { renderDocument } from '$lib/markdown';
import { parseDocument } from '$lib/publishing/document';

const ENGLISH_DOC = [
  '---',
  'lang: en',
  '---',
  '',
  'نص عربي في مستند إنجليزي.',
  '',
  '1. Item one',
  '',
  '![B](b.png)',
  '',
  '$$',
  'x^2',
  '$$',
  '',
  ':::theorem {#t}',
  'Statement',
  ':::',
  '',
  'See [ref:theorem:t].',
].join('\n');

const ARABIC_DOC = [
  '---',
  'lang: ar',
  '---',
  '',
  'English prose in an Arabic document.',
  '',
  '1. البند الأول',
  '',
  '![B](b.png)',
  '',
  '$$',
  'x^2',
  '$$',
  '',
  ':::theorem {#t}',
  'نص',
  ':::',
  '',
  'انظر [ref:theorem:t].',
].join('\n');

describe('document language front-matter', () => {
  it('drives labels and generated digits in English documents', () => {
    const { html } = renderDocument(ENGLISH_DOC);
    expect(html).toContain('Figure 1');
    expect(html).toContain('<figcaption class="eq-number">(1)</figcaption>');
    expect(html).toContain('Theorem 1');
    expect(html).not.toContain('sw-num-ai');
  });

  it('drives labels and generated digits in Arabic documents', () => {
    const { html } = renderDocument(ARABIC_DOC);
    expect(html).toContain('الشكل ١');
    expect(html).toContain('<figcaption class="eq-number">(١)</figcaption>');
    expect(html).toContain('نظرية ١');
    expect(html).toContain('sw-num-ai');
  });

  it('strips the front-matter from the rendered output', () => {
    const { html } = renderDocument('---\nlang: ar\n---\n\n# عنوان');
    expect(html).toContain('<h1 dir="auto">عنوان</h1>');
    expect(html).not.toContain('lang: ar');
    expect(html).not.toContain('<hr');
  });

  it('keeps equation line numbers absolute in the source', () => {
    const { equations } = renderDocument(ENGLISH_DOC);
    expect(equations[0]?.line).toBe(10);
  });

  it('carries the front-matter language into the publishing model', () => {
    const doc = parseDocument('---\nlang: en\ntitle: My Title\n---\n\n# Heading\n\nEnglish text');
    expect(doc.meta.lang).toBe('en');
    expect(doc.meta.direction).toBe('ltr');
    expect(doc.meta.title).toBe('My Title');
    expect(doc.blocks[0]?.type).toBe('heading');
  });

  it('falls back to language detection without front-matter', () => {
    expect(parseDocument('هذا نص عربي').meta.lang).toBe('ar');
    expect(parseDocument('This is English').meta.lang).toBe('en');
  });
});
