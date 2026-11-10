/* ── Publishing AST: block-level nodes ── */

import type { BibEntry } from '../bibliography';

/* ── Position metadata ── */

export interface SourcePos {
  line: number;
  col: number;
}

/* ── Inline nodes ── */

export type InlineNode =
  | TextNode
  | StrongNode
  | EmphasisNode
  | StrikethroughNode
  | InlineCodeNode
  | LinkNode
  | InlineMathNode
  | FootnoteRefNode
  | CitationNode
  | EquationRefNode
  | BlockRefNode
  | WikiLinkNode
  | LineBreakNode
  | InlineImageNode;

export interface TextNode {
  type: 'text';
  value: string;
}

export interface StrongNode {
  type: 'strong';
  children: InlineNode[];
}

export interface EmphasisNode {
  type: 'emphasis';
  children: InlineNode[];
}

export interface StrikethroughNode {
  type: 'strikethrough';
  children: InlineNode[];
}

export interface InlineCodeNode {
  type: 'inlineCode';
  value: string;
}

export interface LinkNode {
  type: 'link';
  url: string;
  title?: string;
  children: InlineNode[];
}

export interface InlineMathNode {
  type: 'inlineMath';
  value: string;
}

export interface FootnoteRefNode {
  type: 'footnoteRef';
  id: string;
}

export interface CitationNode {
  type: 'citation';
  key: string;
}

export interface EquationRefNode {
  type: 'equationRef';
  ref: string;
  /** Resolved text, e.g. "(2)"; undefined if the label is unknown. */
  display?: string;
}

export interface BlockRefNode {
  type: 'blockRef';
  ref: string;
  /** Resolved text, e.g. "Theorem 2"; undefined if the label is unknown. */
  display?: string;
}

export interface WikiLinkNode {
  type: 'wikiLink';
  target: string;
  display?: string;
}

export interface LineBreakNode {
  type: 'lineBreak';
}

export interface InlineImageNode {
  type: 'inlineImage';
  src: string;
  alt: string;
  title?: string;
}

/* ── Block nodes ── */

export type BlockNode =
  | HeadingNode
  | ParagraphNode
  | ThematicBreakNode
  | CodeBlockNode
  | BlockquoteNode
  | ListNode
  | ListItemNode
  | ImageFigureNode
  | TableNode
  | MathBlockNode
  | FootnoteDefinitionNode
  | PoetryNode
  | AcademicBlockNode
  | MatnNode
  | SharhNode
  | HashiyahNode
  | HtmlBlockNode
  | FigureGroupNode;

export interface HeadingNode {
  type: 'heading';
  level: number;
  children: InlineNode[];
  id?: string;
}

export interface ParagraphNode {
  type: 'paragraph';
  children: InlineNode[];
}

export interface ThematicBreakNode {
  type: 'thematicBreak';
}

export interface CodeBlockNode {
  type: 'codeBlock';
  language?: string;
  value: string;
}

export interface BlockquoteNode {
  type: 'blockquote';
  children: BlockNode[];
}

export interface ListNode {
  type: 'list';
  ordered: boolean;
  start?: number;
  tight: boolean;
  items: ListItemNode[];
}

export interface ListItemNode {
  type: 'listItem';
  checked?: boolean;
  children: BlockNode[];
}

export interface ImageFigureNode {
  type: 'imageFigure';
  src: string;
  alt: string;
  title?: string;
  caption?: string;
  id?: string;
  number?: number;
}

export interface TableNode {
  type: 'table';
  header: TableRowNode[];
  body: TableRowNode[];
  caption?: string;
  id?: string;
  number?: number;
}

export interface TableRowNode {
  type: 'tableRow';
  cells: TableCellNode[];
}

export interface TableCellNode {
  type: 'tableCell';
  children: InlineNode[];
  align?: 'left' | 'center' | 'right';
}

export interface MathBlockNode {
  type: 'mathBlock';
  value: string;
  label?: string;
  id?: string;
  number?: number;
}

export interface FootnoteDefinitionNode {
  type: 'footnoteDefinition';
  id: string;
  children: BlockNode[];
}

export interface PoetryNode {
  type: 'poetry';
  verses: PoetryVerse[];
}

export interface PoetryVerse {
  sadr: string;
  ajuz?: string;
}

export interface AcademicBlockNode {
  type: 'academicBlock';
  blockType: string;
  label?: string;
  id?: string;
  number?: number;
  children: BlockNode[];
}

export interface MatnNode {
  type: 'matn';
  children: BlockNode[];
}

export interface SharhNode {
  type: 'sharh';
  children: BlockNode[];
}

export interface HashiyahNode {
  type: 'hashiyah';
  children: BlockNode[];
}

export interface HtmlBlockNode {
  type: 'htmlBlock';
  value: string;
}

export interface FigureGroupNode {
  type: 'figureGroup';
  kind: 'image' | 'table' | 'equation';
  children: [ImageFigureNode | TableNode | MathBlockNode];
  caption?: string;
  id?: string;
  number?: number;
}

/* ── Document metadata ── */

export interface DocumentMeta {
  title?: string;
  author?: string;
  date?: string;
  lang?: string;
  direction?: 'rtl' | 'ltr';
  [key: string]: unknown;
}

/* ── Document model ── */

export interface DocumentModel {
  meta: DocumentMeta;
  blocks: BlockNode[];
  bibEntries: BibEntry[];
  errors: string[];
}
