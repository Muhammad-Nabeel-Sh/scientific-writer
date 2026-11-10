import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseBibTeX } from '$lib/bibliography';
import { renderMarkdown } from '$lib/markdown';

const FIXTURES = fileURLToPath(new URL('../../../tests/fixtures/', import.meta.url));

const NOTE_FILES = [
  'classical-book-intro.md',
  'classical-matn-taharah.md',
  'classical-matn-salah.md',
  'classical-sharh-taharah.md',
  'classical-sharh-salah.md',
  'classical-hawashi.md',
  'interlinear-gloss.md',
  'code-and-table.md',
] as const;

const bibEntries = parseBibTeX(readFileSync(FIXTURES + 'references.bib', 'utf8'));

function renderFixture(file: string, digitStyle: 'auto' | 'eastern' | 'western' = 'auto'): string {
  const source = readFileSync(FIXTURES + file, 'utf8');
  return renderMarkdown(source, bibEntries, digitStyle);
}

describe('renderMarkdown golden snapshots', () => {
  for (const file of NOTE_FILES) {
    it(`renders ${file}`, () => {
      const html = renderFixture(file);
      expect(html).not.toContain('خطأ في تحليل المعادلات الرياضية');
      expect(html).toMatchSnapshot();
    });
  }

  it('renders code and tables with eastern digits', () => {
    expect(renderFixture('code-and-table.md', 'eastern')).toMatchSnapshot();
  });

  it('renders empty input without throwing', () => {
    expect(renderMarkdown('', bibEntries, 'auto')).toMatchSnapshot();
  });

  it('renders a bibliography for cited fixtures', () => {
    const html = renderMarkdown('See [@2021Rehabilitation].', bibEntries, 'auto');
    expect(html).toContain('bibliography');
    expect(html).toMatchSnapshot();
  });

  it('does not convert digits inside multi-line display math', () => {
    const html = renderMarkdown('$$\ns_1^2 + x_2\n$$', [], 'eastern');
    expect(html).not.toContain('خطأ في تحليل المعادلات الرياضية');
    expect(html).toContain('s_1^2 + x_2');
    expect(html).not.toContain('s_١');
    expect(html).toMatch(/katex/);
  });

  it('does not convert digits inside Arabic display math with auto style', () => {
    const html = renderMarkdown('$$\n\\text{السرعة} = 2t\n$$', [], 'auto');
    expect(html).toContain('2t');
    expect(html).not.toContain('٢t');
  });

  it('still converts digits in prose', () => {
    expect(renderMarkdown('السرعة 2 متر', [], 'eastern')).toContain('٢');
  });
});
