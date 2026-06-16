import quranData from './quran.json';

export interface Verse {
  surah: number;
  ayah: number;
  text: string;
  sname: string;
}

const verses: Verse[] = quranData.verses;

const DIACRITICS = /[\u064B-\u065F\u0670\u0640\u06D6-\u06DC\u06DE\u06E9]/g;

function stripDiacritics(s: string): string {
  return s.replace(DIACRITICS, '');
}

function normalizeArabic(s: string): string {
  return stripDiacritics(s)
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchQuran(query: string): Verse[] {
  if (!query.trim()) return [];
  const q = normalizeArabic(query.trim());
  const results: Verse[] = [];
  for (const v of verses) {
    const ntext = normalizeArabic(v.text);
    const nsname = normalizeArabic(v.sname);
    if (ntext.includes(q) || nsname.includes(q)) {
      results.push(v);
    }
  }
  return results.slice(0, 100);
}

const surahVerseCounts: Record<number, number> = {};
for (const v of verses) {
  surahVerseCounts[v.surah] = v.ayah;
}

export function getMaxAyah(surah: number): number {
  return surahVerseCounts[surah] || 0;
}

export function getVersesInRange(surah: number, fromAyah: number, toAyah: number): Verse[] {
  return verses.filter(v => v.surah === surah && v.ayah >= fromAyah && v.ayah <= toAyah);
}

export function formatVerse(v: Verse): string {
  return `> ﴿${v.text}﴾ [${v.sname}: ${v.ayah}]`;
}

export function formatVerseRange(verses: Verse[]): string {
  if (verses.length === 0) return '';
  const sname = verses[0].sname;
  const surah = verses[0].surah;
  const fromAyah = verses[0].ayah;
  const toAyah = verses[verses.length - 1].ayah;
  if (verses.length === 1) {
    return formatVerse(verses[0]);
  }
  const parts = verses.map(v => `${v.text} [${v.ayah}]`);
  const text = parts.join(' ');
  return `> ﴿${text}﴾\n> [${sname}: ${fromAyah}-${toAyah}]`;
}
