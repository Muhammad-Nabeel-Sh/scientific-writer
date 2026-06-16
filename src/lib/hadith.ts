import { invoke } from '@tauri-apps/api/core';
import Fuse from 'fuse.js';

const DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g;
const REPLACE_ALIF = /[إأآا]/g;
const REPLACE_YAA = /[ىئ]/g;
const REPLACE_TAA = /ة/g;
const REPLACE_WAW = /ؤ/g;

function normalizeArabic(s: string): string {
  return s
    .replace(DIACRITICS, '')
    .replace(REPLACE_ALIF, 'ا')
    .replace(REPLACE_YAA, 'ي')
    .replace(REPLACE_TAA, 'ه')
    .replace(REPLACE_WAW, 'و')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface HadithChapter {
  id: number;
  bookId: number;
  arabic: string;
  english: string;
}

export interface Hadith {
  id: number;
  idInBook: number;
  chapterId: number;
  bookId: number;
  arabic: string;
  english: { narrator: string; text: string };
}

export interface HadithBookMeta {
  id: number;
  key: string;
  title: string;
  author: string;
  length: number;
}

export interface HadithSearchResult {
  id: number;
  idInBook: number;
  bookKey: string;
  bookTitle: string;
  chapter: string;
  arabic: string;
  english: string;
}

let fuse: Fuse<HadithSearchResult> | null = null;
let loading = false;
const allResults: HadithSearchResult[] = [];

export async function loadAllHadiths(onProgress?: (key: string, done: number, total: number) => void): Promise<void> {
  if (loading || fuse) return;
  loading = true;
  const keys = await invoke<string[]>('get_hadith_books');
  let totalLoaded = 0;
  for (const key of keys) {
    const raw = await invoke<string>('read_hadith_book', { book: key });
    const data = JSON.parse(raw);
    const chapters = data.chapters as HadithChapter[];
    const chMap = new Map(chapters.map((c: HadithChapter) => [c.id, c.arabic]));
    for (const h of data.hadiths as Hadith[]) {
      allResults.push({
        id: h.id,
        idInBook: h.idInBook,
        bookKey: key,
        bookTitle: data.metadata.arabic.title,
        chapter: chMap.get(h.chapterId) || '',
        arabic: h.arabic,
        english: h.english?.text || '',
      });
    }
    totalLoaded += data.hadiths.length;
    onProgress?.(key, totalLoaded, 0);
  }
  fuse = new Fuse(allResults, {
    keys: [
      { name: 'arabic', weight: 2, getFn: (item) => normalizeArabic(item.arabic) },
      { name: 'chapter', weight: 1, getFn: (item) => normalizeArabic(item.chapter) },
      { name: 'english', weight: 0.5 },
    ],
    threshold: 0.35,
    distance: 200,
    minMatchCharLength: 2,
  });
  loading = false;
}

export function searchHadiths(query: string): HadithSearchResult[] {
  if (!fuse || !query.trim()) return [];
  // Normalize query too so matching works when user types without diacritics
  const q = normalizeArabic(query.trim());
  return fuse.search(q).map(r => r.item).slice(0, 80);
}

export function formatHadithInsert(r: HadithSearchResult): string {
  return `> قَالَ رَسُولُ اللَّهِ ﷺ: «${r.arabic}» [${r.bookTitle}: ${r.idInBook}]`;
}
