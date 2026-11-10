/**
 * Markdown → publishing AST (DocumentModel) for the exporters.
 *
 * Uses the same parser and plugins as the preview (src/lib/md/parser.ts);
 * see from-tokens.ts. There is no separate export parser any more.
 */
import type { BibEntry } from '../bibliography';
import { parse } from '../md/parser';
import type { DocumentMeta, DocumentModel, InlineNode } from './ast';
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

export function parseDocument(markdown: string, bibEntries: BibEntry[] = []): DocumentModel {
  // Exporters receive the author's digits unchanged; numeral style is an output decision.
  const { tokens, env } = parse(markdown, { bibEntries, digitStyle: 'western' });
  const blocks = tokensToBlocks(tokens);

  const meta: DocumentMeta = {};
  const first = blocks[0];
  if (first?.type === 'heading' && first.level === 1) meta.title = plainText(first.children);

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
