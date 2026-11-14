/**
 * Shared by the LaTeX and Typst exporters: when the document's first block is
 * the H1 that became `meta.title`, it is printed as the title and not repeated
 * as a section. If that was the only H1, the remaining headings move up one
 * level (H2 → top-level section), so numbering starts at 1, not 0.1.
 */
import type { BlockNode, DocumentModel } from './ast';

export interface BodyWithoutTitle {
  blocks: BlockNode[];
  /** Subtract from heading levels (0 or 1). */
  headingShift: number;
}

function hasH1(blocks: BlockNode[]): boolean {
  return blocks.some(
    (b) =>
      (b.type === 'heading' && b.level === 1) ||
      ('children' in b && Array.isArray(b.children) && b.type !== 'heading' && b.type !== 'paragraph' && hasH1(b.children as BlockNode[])),
  );
}

export function bodyWithoutTitle(model: DocumentModel): BodyWithoutTitle {
  const first = model.blocks[0];
  if (!model.meta.title || first?.type !== 'heading' || first.level !== 1) {
    return { blocks: model.blocks, headingShift: 0 };
  }
  const rest = model.blocks.slice(1);
  return { blocks: rest, headingShift: hasH1(rest) ? 0 : 1 };
}
