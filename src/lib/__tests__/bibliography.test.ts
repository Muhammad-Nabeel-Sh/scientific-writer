import { describe, expect, it } from 'vitest';
import {
  bibliographyHeading,
  formatBibliographyEntry,
  formatInText,
  generateBibliographyHtml,
  isArabicEntry,
  isArabicText,
  parseBibTeX,
  replaceCitations,
  type BibEntry,
} from '$lib/bibliography';

const SAMPLE = `% a comment line
@article{smith2020,
  author = {Smith, John and Doe, Jane},
  title = {The {DNA} story},
  journal = {Nature},
  year = {2020},
  volume = {10},
  number = {2},
  pages = {1--10},
}

@book{ibn2021,
  author = {ابن خلدون},
  title = {المقدمة},
  publisher = {دار الفكر},
  year = {2021},
}

@string{foo = "bar"}
`;

const ENTRIES = parseBibTeX(SAMPLE);

describe('parseBibTeX', () => {
  it('parses multiple entries and lowercases field names', () => {
    expect(ENTRIES).toHaveLength(2);
    expect(ENTRIES[0].key).toBe('smith2020');
    expect(ENTRIES[0].type).toBe('article');
    expect(ENTRIES[0].fields.author).toBe('Smith, John and Doe, Jane');
    expect(ENTRIES[0].fields.title).toBe('The DNA story');
    expect(ENTRIES[0].fields.pages).toBe('1--10');
    expect(ENTRIES[1].fields.publisher).toBe('دار الفكر');
  });

  it('skips @string, @comment and @preamble blocks', () => {
    const entries = parseBibTeX(`@comment{ignored}
@string{x = "y"}
@preamble{"\\newcommand{\\x}{y}"}
@misc{real, title = {Kept}}`);
    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe('real');
  });

  it('handles quoted values and nested braces', () => {
    const entries = parseBibTeX('@misc{key, title = "A {Nested} Value", note = {outer {inner} end}}');
    expect(entries[0].fields.title).toBe('A {Nested} Value');
    expect(entries[0].fields.note).toBe('outer inner end');
  });

  it('returns an empty array for empty or entry-free content', () => {
    expect(parseBibTeX('')).toEqual([]);
    expect(parseBibTeX('   \n\n')).toEqual([]);
    expect(parseBibTeX('no entries here')).toEqual([]);
  });

  it('ignores an @ that does not start a line', () => {
    expect(parseBibTeX('see @article{x, title = {Nope}}')).toEqual([]);
  });

  it('does not crash on unbalanced braces', () => {
    expect(parseBibTeX('@misc{broken, title = {unclosed')).toEqual([]);
  });
});

describe('Arabic detection', () => {
  it('detects Arabic in author/title and plain text', () => {
    expect(isArabicEntry(ENTRIES[0])).toBe(false);
    expect(isArabicEntry(ENTRIES[1])).toBe(true);
    expect(isArabicText('مرحبا')).toBe(true);
    expect(isArabicText('hello')).toBe(false);
    expect(isArabicText('hello مرحبا')).toBe(true);
  });
});

describe('in-text citation formatting', () => {
  it('formats English author-year citations', () => {
    expect(formatInText(ENTRIES[0])).toBe('Smith & Doe, 2020');
  });

  it('formats Arabic citations and falls back to د.ت.', () => {
    expect(formatInText(ENTRIES[1])).toBe('خلدون، 2021');
    const noYear: BibEntry = { key: 'x', type: 'book', fields: { author: 'مؤلف' } };
    expect(formatInText(noYear)).toBe('مؤلف، د.ت.');
  });
});

describe('replaceCitations', () => {
  it('replaces known keys and reports used keys', () => {
    const result = replaceCitations('See [@smith2020].', ENTRIES);
    expect(result.text).toBe('See (Smith & Doe, 2020).');
    expect(result.usedKeys).toEqual(['smith2020']);
    expect(result.missingKeys).toEqual([]);
  });

  it('reports missing keys inline', () => {
    const result = replaceCitations('See [@missing].', ENTRIES);
    expect(result.text).toBe('See (?missing?).');
    expect(result.usedKeys).toEqual([]);
    expect(result.missingKeys).toEqual(['missing']);
  });

  it('supports multiple keys and deduplicates used keys', () => {
    const result = replaceCitations(
      '[@smith2020; @ibn2021] and again [@smith2020].',
      ENTRIES,
    );
    expect(result.text).toBe('(Smith & Doe, 2020; خلدون، 2021) and again (Smith & Doe, 2020).');
    expect(result.usedKeys).toEqual(['smith2020', 'ibn2021']);
    expect(result.missingKeys).toEqual([]);
  });

  it('leaves text without citations untouched', () => {
    expect(replaceCitations('No citations here.', ENTRIES)).toEqual({
      text: 'No citations here.',
      usedKeys: [],
      missingKeys: [],
    });
  });
});

describe('bibliography output', () => {
  it('chooses the heading from the entries', () => {
    expect(bibliographyHeading([ENTRIES[0]])).toBe('References');
    expect(bibliographyHeading([ENTRIES[1]])).toBe('المراجع');
    expect(bibliographyHeading([])).toBe('References');
  });

  it('formats English and Arabic bibliography entries', () => {
    expect(formatBibliographyEntry(ENTRIES[0], 1)).toContain('[1] Smith, John and Doe, Jane (2020)');
    expect(formatBibliographyEntry(ENTRIES[0], 1)).toContain('Nature, 10 (2), 1--10.');
    expect(formatBibliographyEntry(ENTRIES[1], 2)).toBe('[2] ابن خلدون (2021). «المقدمة». الناشر: دار الفكر.');
  });

  it('generates bibliography HTML with used and missing references', () => {
    const html = generateBibliographyHtml(['smith2020'], ENTRIES, ['nope']);
    expect(html).toContain('<h2 id="bibliography">References</h2>');
    expect(html).toContain('id="ref-smith2020"');
    expect(html).toContain('Missing references');
    expect(html).toContain('<li>nope</li>');
  });

  it('returns an empty bibliography when nothing is cited', () => {
    expect(generateBibliographyHtml([], ENTRIES, [])).toBe('');
  });
});
