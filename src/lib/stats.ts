const ARABIC_LETTER = /[\u0621-\u064A\u066E\u066F\u0671-\u06D5\u06EE\u06EF\u06FA-\u06FC\u06FF\u0750-\u077F\u08A0-\u08C9]/;
const DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED\u08E0-\u08FF]/g;
const PUNCTUATION = /[\u0600-\u0605\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u2000-\u206F\u3000-\u303F\uff00-\uffef!"#$%&'()*+,\-.\/:;<=>?@[\\\]^_`{|}~]+/g;

export interface NoteStats {
  words: number;
  characters: number;
  paragraphs: number;
  headings: number;
  images: number;
  figures: number;
  tables: number;
}

const zeroStats: NoteStats = {
  words: 0,
  characters: 0,
  paragraphs: 0,
  headings: 0,
  images: 0,
  figures: 0,
  tables: 0,
};

function stripNonLetter(text: string): string {
  return text.replace(DIACRITICS, '').replace(PUNCTUATION, '').replace(/\s+/g, ' ');
}

export function computeStats(text: string): NoteStats {
  if (!text.trim()) return { ...zeroStats };

  const cleaned = stripNonLetter(text);
  const characters = [...cleaned].filter(c => ARABIC_LETTER.test(c)).length;
  const words = cleaned.split(/\s+/).filter(Boolean).filter(t => ARABIC_LETTER.test(t)).length;
  const paragraphs = text.split(/\n\s*\n/).filter(b => b.trim().length > 0).length;
  const headings = (text.match(/^#{1,6}\s/gm) || []).length;
  const images = (text.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || []).length;
  const figures = images;

  let tables = 0;
  let inTable = false;
  for (const line of text.split('\n')) {
    if (line.trimStart().startsWith('|')) {
      if (!inTable) { tables++; inTable = true; }
    } else {
      inTable = false;
    }
  }

  return { words, characters, paragraphs, headings, images, figures, tables };
}

export function addStats(a: NoteStats, b: NoteStats): NoteStats {
  return {
    words: a.words + b.words,
    characters: a.characters + b.characters,
    paragraphs: a.paragraphs + b.paragraphs,
    headings: a.headings + b.headings,
    images: a.images + b.images,
    figures: a.figures + b.figures,
    tables: a.tables + b.tables,
  };
}
