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

export function computeStats(text: string): NoteStats {
  if (!text.trim()) return { ...zeroStats };

  const characters = text.replace(/\n/g, '').length;
  const words = text.split(/\s+/).filter(Boolean).length;
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
