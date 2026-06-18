import type { BibEntry } from './bibliography';

/* ── Arabic CSL label maps ── */

export const AR_CSL: Record<string, string> = {
  page: 'ص',
  pages: 'ص',
  volume: 'جـ',
  number: 'ع',
  edition: 'ط',
  publisher: 'الناشر',
  journal: 'مجلة',
  in: 'في',
  phdthesis: 'رسالة دكتوراه',
  mastersthesis: 'رسالة ماجستير',
  manuscript: 'مخطوط',
  tabaqat: 'طبقات',
};

export function isArabicText(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/* ── Manuscript citation ── */

export interface ManuscriptFields {
  library?: string;
  siglum?: string;
  shelfmark?: string;
  folio?: string;
  side?: string; // أ = recto, ب = verso
}

export function formatManuscriptCitation(fields: Record<string, string>): string {
  const siglum = fields.library || fields.siglum || '';
  const shelf = fields.shelfmark || fields.number || '';
  const folio = fields.folio || '';
  const side = fields.side || '';

  let result = siglum;
  if (shelf) result += ` ${shelf}`;
  if (folio) {
    result += `، ورقة ${folio}`;
    if (side) result += side;
  }
  return result.trim() || 'مخطوط';
}

/* ── Tabaqat citation ── */

export interface TabaqatFields {
  author?: string;
  tabaqa?: string;
  generation?: string;
  death?: string;
  year?: string;
  pages?: string;
  page?: string;
}

export function formatTabaqatCitation(fields: Record<string, string>): string {
  const author = fields.author || '';
  const tabaqa = fields.tabaqa || fields.generation || '';
  const death = fields.death || fields.year || '';
  const page = fields.pages || fields.page || '';

  const parts: string[] = [];
  if (author) parts.push(author.replace(/[{}]/g, '').trim());
  if (tabaqa) parts.push(`الطبقة ${tabaqa}`);
  if (death) parts.push(`ت ${death}`);
  if (page) parts.push(`ص ${page}`);
  return parts.join('، ');
}

/* ── Arabic bibliography entry formatter ── */

export function formatArabicBibliographyEntry(entry: BibEntry, index: number): string {
  const clean = (s: string) => s.replace(/[{}]/g, '').trim();
  const author = clean(entry.fields.author || '');
  const title = clean(entry.fields.title || '');
  const year = clean(entry.fields.year || 'د.ت.');
  const journal = clean(entry.fields.journal || '');
  const booktitle = clean(entry.fields.booktitle || '');
  const publisher = clean(entry.fields.publisher || '');
  const volume = clean(entry.fields.volume || '');
  const number = clean(entry.fields.number || '');
  const pages = clean(entry.fields.pages || '');
  const note = clean(entry.fields.note || '');
  const school = clean(entry.fields.school || '');
  const edition = clean(entry.fields.edition || '');

  if (entry.type === 'manuscript') {
    return `[${index}] ${author ? author + '. ' : ''}«${title}». ${formatManuscriptCitation(entry.fields)}${year !== 'د.ت.' ? ` (${year})` : ''}.`;
  }

  if (entry.type === 'tabaqat') {
    return `[${index}] ${author ? author + '. ' : ''}«${title}». ${formatTabaqatCitation(entry.fields)}.`;
  }

  let text = `[${index}] ${author}`;
  if (year !== 'د.ت.') text += ` (${year})`;
  text += `. «${title}»`;

  if (entry.type === 'article') {
    if (journal) text += `. ${AR_CSL.journal}: ${journal}`;
    if (volume) text += `، ${AR_CSL.volume} ${volume}`;
    if (number) text += ` (${AR_CSL.number} ${number})`;
    if (pages) text += `، ${AR_CSL.pages} ${pages}`;
    text += '.';
  } else if (entry.type === 'book') {
    if (edition) text += ` (${AR_CSL.edition} ${edition})`;
    if (publisher) text += `. ${AR_CSL.publisher}: ${publisher}`;
    text += '.';
  } else if (entry.type === 'inproceedings' || entry.type === 'incollection') {
    if (booktitle) text += `. ${AR_CSL.in} «${booktitle}»`;
    if (publisher) text += `. ${AR_CSL.publisher}: ${publisher}`;
    if (pages) text += `، ${AR_CSL.pages} ${pages}`;
    text += '.';
  } else if (entry.type === 'phdthesis') {
    text += `. ${AR_CSL.phdthesis}`;
    if (school) text += `، ${school}`;
    text += '.';
  } else if (entry.type === 'mastersthesis') {
    text += `. ${AR_CSL.mastersthesis}`;
    if (school) text += `، ${school}`;
    text += '.';
  } else {
    text += '.';
  }
  if (note) text += ` ${note}`;
  return text;
}

/* ── Arabic in-text citation ── */

export function formatArabicInText(entry: BibEntry): string {
  const year = entry.fields.year?.replace(/[{}]/g, '') || 'د.ت.';

  if (entry.type === 'manuscript') {
    return formatManuscriptCitation(entry.fields) + (year !== 'د.ت.' ? `، ${year}` : '');
  }

  if (entry.type === 'tabaqat') {
    return formatTabaqatCitation(entry.fields);
  }

  return `${entry.fields.author?.replace(/[{}]/g, '').trim() || 'مجهول'}، ${year}`;
}
