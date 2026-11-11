import { describe, expect, it } from 'vitest';
import { ensureBuiltinSymbols, expandPandocMacros, toPandocHeader } from '$lib/math';
import { documentToPandocMarkdown } from '$lib/publishing/pandoc-markdown';
import type { DocumentModel } from '$lib/publishing/ast';

function model(meta: DocumentModel['meta'], blocks: DocumentModel['blocks']): DocumentModel {
  return { meta, blocks, bibEntries: [], errors: [] };
}

describe('toPandocHeader', () => {
  it('emits only symbols used in the document and drops LaTeX-only wrappers', () => {
    ensureBuiltinSymbols();
    const header = toPandocHeader('\\jaa س + \\rsum');
    expect(header).toContain('\\newcommand{\\jaa}{\\operatorname{\\text{جا}}}');
    expect(header).toContain('\\newcommand{\\rsum}');
    expect(header).not.toContain('\\textarabic');
    expect(header).not.toContain('\\reflectbox');
    expect(header).not.toContain('\\arBeh');
  });

  it('keeps macro arity and the argument placeholder', () => {
    const header = toPandocHeader('\\arFact{س}');
    expect(header).toBe('\\newcommand{\\arFact}[1]{!#1}');
  });

  it('returns an empty string when no registry symbol is used', () => {
    expect(toPandocHeader('plain text with $x^2$')).toBe('');
  });
});

describe('expandPandocMacros', () => {
  it('expands registry macros inside display and inline math only', () => {
    const before = '\\jaa outside $$\\jaa س + \\rsum$$ and $\\jaa$';
    const after = expandPandocMacros(before);
    expect(after.startsWith('\\jaa outside')).toBe(true);
    expect(after).toContain('\\operatorname{\\text{جا}} س');
    expect(after).toContain('\\operatorname*{\\sum}');
    expect(after.match(/\\jaa/g)?.length).toBe(1); // the outside text remains
  });

  it('substitutes macro arguments', () => {
    const after = expandPandocMacros('$\\arFact{س}$');
    expect(after).toBe('$!{س}$');
  });
});

describe('documentToPandocMarkdown', () => {
  it('renders YAML, resolved refs, citations, math and the registry header', () => {
    const md = documentToPandocMarkdown(model(
      { title: 'اختبار', lang: 'ar', direction: 'rtl', arabicFont: 'Amiri' },
      [
        { type: 'heading', level: 1, children: [{ type: 'text', value: 'عنوان' }] },
        { type: 'paragraph', children: [
          { type: 'text', value: 'انظر ' },
          { type: 'equationRef', ref: 'energy', display: '(2)' },
          { type: 'text', value: ' ' },
          { type: 'citation', key: 'smith2020' },
        ] },
        { type: 'mathBlock', value: '\\jaa س', label: 'energy', number: 2 },
        { type: 'table', header: [
          { type: 'tableRow', cells: [
            { type: 'tableCell', children: [{ type: 'text', value: 'أ' }] },
            { type: 'tableCell', children: [{ type: 'text', value: 'ب' }] },
          ] },
        ], body: [] },
      ],
    ));

    expect(md).toContain('lang: ar');
    expect(md).toContain('dir: rtl');
    expect(md).toContain('mainfont: "Amiri"');
    expect(md).toContain('# عنوان');
    expect(md).toContain('(2)');
    expect(md).toContain('[@smith2020]');
    expect(md).toContain('$$');
    expect(md).toContain('\\newcommand{\\jaa}');
    expect(md).toContain('\\operatorname{\\text{جا}}');
    expect(md).not.toContain('[ref:');
    expect(md).not.toContain(':::');
    expect(md).toContain('| أ | ب |');
  });

  it('honours LTR documents', () => {
    const md = documentToPandocMarkdown(model({ lang: 'en', direction: 'ltr' }, []));
    expect(md).toContain('lang: en');
    expect(md).toContain('dir: ltr');
    expect(md).toContain('mainfont: "Amiri"');
  });
});
