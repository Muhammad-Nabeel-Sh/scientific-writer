import { describe, expect, it } from 'vitest';
import {
  AR_CSL,
  formatArabicBibliographyEntry,
  formatArabicInText,
  formatManuscriptCitation,
  formatTabaqatCitation,
  isArabicText,
} from '$lib/citation-arabic';
import type { BibEntry } from '$lib/bibliography';

describe('Arabic CSL labels', () => {
  it('exposes the conventional Arabic abbreviations', () => {
    expect(AR_CSL.page).toBe('ص');
    expect(AR_CSL.pages).toBe('ص');
    expect(AR_CSL.volume).toBe('جـ');
    expect(AR_CSL.number).toBe('ع');
    expect(AR_CSL.edition).toBe('ط');
    expect(AR_CSL.publisher).toBe('الناشر');
    expect(AR_CSL.phdthesis).toBe('رسالة دكتوراه');
    expect(AR_CSL.manuscript).toBe('مخطوط');
  });
});

describe('isArabicText', () => {
  it('detects Arabic ranges', () => {
    expect(isArabicText('مخطوط')).toBe(true);
    expect(isArabicText('Manuscript')).toBe(false);
    expect(isArabicText('MS 12، ورقة 3')).toBe(true);
  });
});

describe('formatManuscriptCitation', () => {
  it('formats library, shelfmark, folio and side', () => {
    expect(
      formatManuscriptCitation({ library: 'BNF', shelfmark: 'Ar 123', folio: '12', side: 'أ' }),
    ).toBe('BNF Ar 123، ورقة 12أ');
  });

  it('supports siglum/number aliases', () => {
    expect(formatManuscriptCitation({ siglum: 'Escorial', number: '42' })).toBe('Escorial 42');
  });

  it('falls back to مخطوط when empty', () => {
    expect(formatManuscriptCitation({})).toBe('مخطوط');
    expect(formatManuscriptCitation({ library: '   ' })).toBe('مخطوط');
  });
});

describe('formatTabaqatCitation', () => {
  it('formats author, tabaqa, death and page', () => {
    expect(
      formatTabaqatCitation({ author: 'ابن سعد', tabaqa: '3', death: '230', pages: '12' }),
    ).toBe('ابن سعد، الطبقة 3، ت 230، ص 12');
  });

  it('supports generation/year/page aliases', () => {
    expect(
      formatTabaqatCitation({ generation: '2', year: '150', page: '7' }),
    ).toBe('الطبقة 2، ت 150، ص 7');
  });

  it('strips braces from the author', () => {
    expect(formatTabaqatCitation({ author: '{ابن حجر}' })).toBe('ابن حجر');
  });
});

const bookEntry: BibEntry = {
  key: 'ibn2021',
  type: 'book',
  fields: { author: 'ابن خلدون', title: 'المقدمة', publisher: 'دار الفكر', year: '2021' },
};

const articleEntry: BibEntry = {
  key: 'smith2020',
  type: 'article',
  fields: {
    author: 'Smith, John',
    title: 'Sur les réseaux',
    journal: 'Nature',
    year: '2020',
    volume: '10',
    number: '2',
    pages: '1--10',
  },
};

describe('formatArabicInText', () => {
  it('formats manuscripts with the year', () => {
    const entry: BibEntry = {
      key: 'ms',
      type: 'manuscript',
      fields: { library: 'BNF', shelfmark: 'Ar 1', folio: '3', year: '900' },
    };
    expect(formatArabicInText(entry)).toBe('BNF Ar 1، ورقة 3، 900');
  });

  it('formats tabaqat entries without a year', () => {
    const entry: BibEntry = {
      key: 'tab',
      type: 'tabaqat',
      fields: { author: 'ابن سعد', tabaqa: '3' },
    };
    expect(formatArabicInText(entry)).toBe('ابن سعد، الطبقة 3');
  });

  it('formats ordinary book entries and falls back to مجهول', () => {
    expect(formatArabicInText(bookEntry)).toBe('ابن خلدون، 2021');
    expect(formatArabicInText({ key: 'x', type: 'book', fields: {} })).toBe('مجهول، د.ت.');
  });
});

describe('formatArabicBibliographyEntry', () => {
  it('formats a book', () => {
    expect(formatArabicBibliographyEntry(bookEntry, 2)).toBe(
      '[2] ابن خلدون (2021). «المقدمة». الناشر: دار الفكر.',
    );
  });

  it('formats an article with volume/number/pages labels', () => {
    expect(formatArabicBibliographyEntry(articleEntry, 1)).toBe(
      '[1] Smith, John (2020). «Sur les réseaux». مجلة: Nature، جـ 10 (ع 2)، ص 1--10.',
    );
  });

  it('formats a manuscript', () => {
    const entry: BibEntry = {
      key: 'ms',
      type: 'manuscript',
      fields: { author: 'المؤلف', title: 'النسخة', library: 'BNF', shelfmark: 'Ar 1' },
    };
    expect(formatArabicBibliographyEntry(entry, 3)).toBe(
      '[3] المؤلف. «النسخة». BNF Ar 1.',
    );
  });

  it('formats a tabaqat entry', () => {
    const entry: BibEntry = {
      key: 'tab',
      type: 'tabaqat',
      fields: { author: 'ابن سعد', title: 'الطبقات', tabaqa: '3' },
    };
    expect(formatArabicBibliographyEntry(entry, 4)).toBe(
      '[4] ابن سعد. «الطبقات». ابن سعد، الطبقة 3.',
    );
  });

  it('formats theses with the right degree label', () => {
    const phd: BibEntry = { key: 'p', type: 'phdthesis', fields: { author: 'باحث', school: 'جامعة' } };
    const ma: BibEntry = { key: 'm', type: 'mastersthesis', fields: { author: 'باحث', school: 'جامعة' } };
    expect(formatArabicBibliographyEntry(phd, 5)).toContain('رسالة دكتوراه');
    expect(formatArabicBibliographyEntry(ma, 6)).toContain('رسالة ماجستير');
  });
});
