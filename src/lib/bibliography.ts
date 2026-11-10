export interface BibEntry {
  key: string;
  type: string;
  fields: Record<string, string>;
}

export function isArabicEntry(entry: BibEntry): boolean {
  const text = (entry.fields.author || '') + (entry.fields.title || '');
  return /[\u0600-\u06FF]/.test(text);
}

export function isArabicText(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export function parseBibTeX(content: string): BibEntry[] {
  const entries: BibEntry[] = [];
  let i = 0;
  while (i < content.length) {
    const atIdx = content.indexOf('@', i);
    if (atIdx === -1) break;
    if (atIdx > 0 && content[atIdx - 1] !== '\n' && content[atIdx - 1] !== '\r') {
      i = atIdx + 1;
      continue;
    }
    const m = content.slice(atIdx).match(/^@(\w+)\s*\{\s*/);
    if (!m) { i = atIdx + 1; continue; }
    const type = m[1].toLowerCase();
    if (type === 'string' || type === 'preamble' || type === 'comment') {
      const openPos = atIdx + m[0].length - 1;
      const close = findMatchingBrace(content, openPos);
      i = close !== -1 ? close + 1 : atIdx + 1;
      continue;
    }
    const keyStart = atIdx + m[0].length;
    let keyEnd = keyStart;
    while (keyEnd < content.length && content[keyEnd] !== ',' && content[keyEnd] !== '}') keyEnd++;
    if (keyEnd >= content.length) { i = atIdx + 1; continue; }
    const key = content.slice(keyStart, keyEnd).trim();
    if (!key) { i = atIdx + 1; continue; }
    const braceStart = atIdx + content.slice(atIdx).indexOf('{');
    const closeBrace = findMatchingBrace(content, braceStart);
    if (closeBrace === -1) { i = atIdx + 1; continue; }
    const inner = content.slice(braceStart + 1, closeBrace);
    const fields = parseFields(inner);
    if (fields) entries.push({ key, type, fields });
    i = closeBrace + 1;
  }
  return entries;
}

function findMatchingBrace(str: string, start: number): number {
  if (str[start] !== '{') return -1;
  let depth = 1;
  let i = start + 1;
  let inString = false;
  while (i < str.length && depth > 0) {
    const c = str[i];
    const prev = i > 0 ? str[i - 1] : '';
    if (inString) {
      if (c === '"' && prev !== '\\') inString = false;
      i++;
      continue;
    }
    if (c === '"' && prev !== '\\') { inString = true; i++; continue; }
    if (c === '{' && prev !== '\\') { depth++; i++; continue; }
    if (c === '}' && prev !== '\\') { depth--; if (depth === 0) return i; i++; continue; }
    i++;
  }
  return -1;
}

function parseFields(inner: string): Record<string, string> | null {
  const fields: Record<string, string> = {};
  let i = 0;
  while (i < inner.length && inner[i] !== ',') i++;
  if (i < inner.length) i++;
  while (i < inner.length) {
    while (i < inner.length && /\s/.test(inner[i])) i++;
    if (i >= inner.length) break;
    let fieldName = '';
    while (i < inner.length && /[a-zA-Z]/.test(inner[i])) { fieldName += inner[i].toLowerCase(); i++; }
    if (!fieldName) { i++; continue; }
    while (i < inner.length && /\s/.test(inner[i])) i++;
    if (inner[i] === '=') i++;
    while (i < inner.length && /\s/.test(inner[i])) i++;
    if (i >= inner.length) break;
    let value = '';
    if (inner[i] === '{') {
      let depth = 0;
      const valStart = i;
      while (i < inner.length) {
        if (inner[i] === '{') depth++;
        if (inner[i] === '}') { depth--; if (depth === 0) { value = inner.slice(valStart + 1, i); i++; break; } }
        i++;
      }
      value = value.replace(/\{([^}]*)\}/g, '$1');
    } else if (inner[i] === '"') {
      i++;
      while (i < inner.length && inner[i] !== '"') { if (inner[i] === '\\') { value += inner[i]; i++; } value += inner[i]; i++; }
      if (i < inner.length) i++;
    } else {
      while (i < inner.length && inner[i] !== ',' && inner[i] !== '}') { if (!/\s/.test(inner[i])) value += inner[i]; i++; }
    }
    fields[fieldName] = value.trim();
    if (i < inner.length && inner[i] === ',') i++;
  }
  return fields;
}

function parseAuthors(authorStr: string): string[] {
  return authorStr.split(' and ').map(a => a.replace(/[{}]/g, '').trim()).filter(Boolean);
}

function getShortAuthor(authorStr: string): string {
  const authors = parseAuthors(authorStr);
  if (authors.length === 0) return '';
  const lastNames = authors.map(a => {
    if (a.includes(',')) return a.split(',')[0].trim();
    const parts = a.split(/\s+/);
    return parts[parts.length - 1];
  });
  if (lastNames.length === 1) return lastNames[0];
  if (lastNames.length === 2) return `${lastNames[0]} & ${lastNames[1]}`;
  return `${lastNames[0]} et al.`;
}

function getShortAuthorArabic(authorStr: string): string {
  const authors = parseAuthors(authorStr);
  if (authors.length === 0) return '';
  const lastNames = authors.map(a => {
    if (a.includes(',')) return a.split(',')[0].trim();
    const parts = a.split(/\s+/);
    return parts[parts.length - 1];
  });
  if (lastNames.length === 1) return lastNames[0];
  if (lastNames.length === 2) return `${lastNames[0]} و${lastNames[1]}`;
  return `${lastNames[0]} وآخرون`;
}

export function formatInText(entry: BibEntry): string {
  const arabic = isArabicEntry(entry);

  if (arabic) {
    return formatInTextArabic(entry);
  }

  const year = entry.fields.year?.replace(/[{}]/g, '') || 'n.d.';
  const author = getShortAuthor(entry.fields.author || '') || 'Unknown';
  return `${author}, ${year}`;
}

function formatInTextArabic(entry: BibEntry): string {
  const year = entry.fields.year?.replace(/[{}]/g, '') || 'د.ت.';

  if (entry.type === 'manuscript') {
    return formatManuscriptCitation(entry.fields) + (year !== 'د.ت.' ? `، ${year}` : '');
  }

  if (entry.type === 'tabaqat') {
    return formatTabaqatCitation(entry.fields);
  }

  const author = getShortAuthorArabic(entry.fields.author || '') || 'مجهول';
  return `${author}، ${year}`;
}

function formatManuscriptCitation(fields: Record<string, string>): string {
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

function formatTabaqatCitation(fields: Record<string, string>): string {
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

export function bibliographyHeading(entries: BibEntry[]): string {
  return entries.some(e => isArabicEntry(e)) ? 'المراجع' : 'References';
}

export function formatBibliographyEntry(entry: BibEntry, index: number): string {
  if (isArabicEntry(entry)) {
    return formatArabicBibliographyEntry(entry, index);
  }

  const clean = (s: string) => s.replace(/[{}]/g, '').trim();
  const author = clean(entry.fields.author || '');
  const title = clean(entry.fields.title || '');
  const year = clean(entry.fields.year || 'n.d.');
  const journal = clean(entry.fields.journal || '');
  const booktitle = clean(entry.fields.booktitle || '');
  const publisher = clean(entry.fields.publisher || '');
  const volume = clean(entry.fields.volume || '');
  const number = clean(entry.fields.number || '');
  const pages = clean(entry.fields.pages || '');
  const note = clean(entry.fields.note || '');
  const school = clean(entry.fields.school || '');
  const edition = clean(entry.fields.edition || '');
  let text = `[${index}] ${author}`;
  if (year !== 'n.d.') text += ` (${year})`;
  text += `. ${title}`;
  if (entry.type === 'article') {
    if (journal) text += `. ${journal}`;
    if (volume) text += `, ${volume}`;
    if (number) text += ` (${number})`;
    if (pages) text += `, ${pages}`;
    text += '.';
  } else if (entry.type === 'book') {
    if (edition) text += ` (${edition})`;
    if (publisher) text += `. ${publisher}`;
    text += '.';
  } else if (entry.type === 'inproceedings' || entry.type === 'incollection') {
    if (booktitle) text += `. In ${booktitle}`;
    if (publisher) text += `. ${publisher}`;
    if (pages) text += `, ${pages}`;
    text += '.';
  } else if (entry.type === 'phdthesis' || entry.type === 'mastersthesis') {
    text += '. PhD thesis';
    if (school) text += `. ${school}`;
    text += '.';
  } else {
    text += '.';
  }
  if (note) text += ` ${note}`;
  return text;
}

function formatArabicBibliographyEntry(entry: BibEntry, index: number): string {
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
    if (journal) text += `. مجلة: ${journal}`;
    if (volume) text += `، جـ ${volume}`;
    if (number) text += ` (ع ${number})`;
    if (pages) text += `، ص ${pages}`;
    text += '.';
  } else if (entry.type === 'book') {
    if (edition) text += ` (ط ${edition})`;
    if (publisher) text += `. الناشر: ${publisher}`;
    text += '.';
  } else if (entry.type === 'inproceedings' || entry.type === 'incollection') {
    if (booktitle) text += `. في «${booktitle}»`;
    if (publisher) text += `. الناشر: ${publisher}`;
    if (pages) text += `، ص ${pages}`;
    text += '.';
  } else if (entry.type === 'phdthesis') {
    text += '. رسالة دكتوراه';
    if (school) text += `، ${school}`;
    text += '.';
  } else if (entry.type === 'mastersthesis') {
    text += '. رسالة ماجستير';
    if (school) text += `، ${school}`;
    text += '.';
  } else {
    text += '.';
  }
  if (note) text += ` ${note}`;
  return text;
}

/**
 * Replace all [@key] citations in text with formatted in-text citations.
 * Returns modified text plus lists of used and missing citation keys.
 */
/** Strip the `ms:` / `tab:` style prefix from a citation key. */
export function citationRealKey(key: string): string {
  return key.startsWith('ms:') ? key.slice(3) : key.startsWith('tab:') ? key.slice(4) : key;
}

/**
 * Tracks which keys a document cites, in first-use order, and formats each
 * in-text citation group `[@a; @ms:b]` → "(A, 2020; …)".
 */
export class CitationTracker {
  readonly usedKeys: string[] = [];
  readonly missingKeys: string[] = [];
  private readonly seen = new Set<string>();
  private readonly entryMap: Map<string, BibEntry>;

  constructor(entries: BibEntry[]) {
    this.entryMap = new Map(entries.map(e => [e.key, e]));
  }

  formatGroup(keys: string[]): string {
    const formatted = keys.map(key => {
      const isMs = key.startsWith('ms:');
      const isTab = key.startsWith('tab:');
      const realKey = citationRealKey(key);
      const entry = this.entryMap.get(realKey);
      if (entry) {
        if (!this.seen.has(realKey)) { this.seen.add(realKey); this.usedKeys.push(realKey); }
        if (isMs) return formatInTextArabic({ ...entry, type: 'manuscript' });
        if (isTab) return formatInTextArabic({ ...entry, type: 'tabaqat' });
        return formatInText(entry);
      }
      if (!this.seen.has(realKey)) { this.seen.add(realKey); this.missingKeys.push(realKey); }
      return `?${realKey}?`;
    });
    return `(${formatted.join('; ')})`;
  }
}

export function replaceCitations(text: string, entries: BibEntry[]): { text: string; usedKeys: string[]; missingKeys: string[] } {
  const tracker = new CitationTracker(entries);
  const result = text.replace(/\[@([^\]]+)\]/g, (_match, keyGroup: string) => {
    const keys = keyGroup.split(';').map(k => k.trim().replace(/^@/, '')).filter(Boolean);
    return tracker.formatGroup(keys);
  });
  return { text: result, usedKeys: tracker.usedKeys, missingKeys: tracker.missingKeys };
}

/**
 * Generate HTML for the bibliography section.
 */
export function generateBibliographyHtml(usedKeys: string[], allEntries: BibEntry[], missingKeys: string[]): string {
  if (usedKeys.length === 0 && missingKeys.length === 0) return '';
  const entryMap = new Map(allEntries.map(e => [e.key, e]));
  const usedEntries = usedKeys.map(k => entryMap.get(k)).filter((e): e is BibEntry => !!e);
  const heading = bibliographyHeading(usedEntries.length > 0 ? usedEntries : allEntries);
  const hasArabic = heading === 'المراجع';
  let html = `<hr class="bib-sep"><section class="bibliography" dir="auto"><h2 id="bibliography">${heading}</h2><ol>`;
  usedKeys.forEach((key, idx) => {
    const entry = entryMap.get(key);
    if (entry) {
      html += `<li id="ref-${key}">${formatBibliographyEntry(entry, idx + 1)}</li>`;
    } else {
      html += `<li class="missing-ref" id="ref-${key}">[${idx + 1}] <em>${key}</em></li>`;
    }
  });
  html += '</ol>';
  if (missingKeys.length > 0) {
    const warnLabel = hasArabic ? 'المراجع غير الموجودة' : 'Missing references';
    html += `<div class="missing-citations"><p>⚠ ${warnLabel}:</p><ul>`;
    for (const key of missingKeys) html += `<li>${key}</li>`;
    html += '</ul></div>';
  }
  html += '</section>';
  return html;
}
