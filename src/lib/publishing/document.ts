/**
 * Markdown → publishing AST (DocumentModel) for the exporters.
 *
 * Uses the same parser and plugins as the preview (src/lib/md/parser.ts);
 * see from-tokens.ts. There is no separate export parser any more.
 */
import type { BibEntry } from '../bibliography';
import { parse } from '../md/parser';
import { frontMatterLanguage, parseFrontMatter } from '../frontmatter';
import type { BlockNode, DocumentMeta, DocumentModel, InlineNode } from './ast';
import { tokensToBlocks } from './from-tokens';

function plainText(nodes: InlineNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === 'text' || n.type === 'inlineCode' || n.type === 'inlineMath') return n.value;
      if ('children' in n) return plainText(n.children);
      return '';
    })
    .join('');
}

const ARABIC_LETTER = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
const LATIN_LETTER = /[A-Za-zÀ-ɏ]/g;

/** All prose text of the document (not code or math), for language detection. */
function proseText(blocks: BlockNode[]): string {
  let s = '';
  const walk = (b: BlockNode) => {
    if ('children' in b && Array.isArray(b.children)) {
      if (b.type === 'heading' || b.type === 'paragraph') s += plainText(b.children as InlineNode[]) + ' ';
      else for (const c of b.children as BlockNode[]) walk(c);
    }
    if (b.type === 'list') for (const it of b.items) for (const c of it.children) walk(c);
    if (b.type === 'table') for (const r of [...b.header, ...b.body]) for (const c of r.cells) s += plainText(c.children) + ' ';
    if (b.type === 'poetry') for (const v of b.verses) s += `${v.sadr} ${v.ajuz ?? ''} `;
  };
  blocks.forEach(walk);
  return s;
}

/** 'ar' when Arabic letters are at least as frequent as Latin ones (an Arabic-first app). */
export function detectLanguage(blocks: BlockNode[]): 'ar' | 'en' {
  const text = proseText(blocks);
  const ar = text.match(ARABIC_LETTER)?.length ?? 0;
  const lat = text.match(LATIN_LETTER)?.length ?? 0;
  return ar >= lat || (ar === 0 && lat === 0) ? 'ar' : 'en';
}

export function parseDocument(markdown: string, bibEntries: BibEntry[] = []): DocumentModel {
  // Exporters receive the author's digits unchanged; numeral style is an output decision.
  const { meta: frontMatter } = parseFrontMatter(markdown);
  const { tokens, env } = parse(markdown, { bibEntries, digitStyle: 'western' });
  const blocks = tokensToBlocks(tokens);

  const meta: DocumentMeta = { ...frontMatter };
  const first = blocks[0];
  if (!meta.title && first?.type === 'heading' && first.level === 1) {
    meta.title = plainText(first.children);
  }
  const lang = frontMatterLanguage(frontMatter) ?? detectLanguage(blocks);
  meta.lang = lang;
  const frontDir =
    frontMatter.direction === 'rtl' || frontMatter.direction === 'ltr'
      ? frontMatter.direction
      : undefined;
  meta.direction = frontDir ?? (lang === 'ar' ? 'rtl' : 'ltr');

  return {
    meta,
    blocks,
    bibEntries,
    errors: env.warnings.map((w) => (w.line != null ? `${w.message} (سطر ${w.line + 1})` : w.message)),
  };
}

/** Convenience: create a DocumentModel from markdown text. */
export function createDocument(markdown: string, bibEntries?: BibEntry[]): DocumentModel {
  return parseDocument(markdown, bibEntries ?? []);
}
