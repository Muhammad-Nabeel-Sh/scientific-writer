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

  // Found in the review (A.6.1): convertArabicDigits protects $$…$$ only when
  // both delimiters are on one line, so multi-line display math is corrupted
  // to Arabic-Indic digits when digitStyle is "eastern" (or "auto" + Arabic).
  it.todo('renderMarkdown must not convert digits inside multi-line display math');
});
