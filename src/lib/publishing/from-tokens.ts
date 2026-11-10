/**
 * markdown-it token stream → publishing AST.
 *
 * Exporters used to have their own hand-written Markdown parser, which
 * disagreed with the preview (and missed poetry, nested containers, …).
 * This builder walks the tokens produced by the *same* parser and plugins
 * as the preview (src/lib/md/parser.ts), so numbering, labels, captions and
 * syntax are identical in every output.
 */
import type Token from 'markdown-it/lib/token.mjs';
import { citationRealKey } from '../bibliography';
import { parsePoem } from '../md/parser';
import type {
  BlockNode,
  InlineNode,
  ListItemNode,
  ListNode,
  TableCellNode,
  TableNode,
  TableRowNode,
} from './ast';

class Cursor {
  i = 0;
  constructor(readonly t: Token[]) {}
  get done() {
    return this.i >= this.t.length;
  }
  peek(): Token {
    return this.t[this.i];
  }
  next(): Token {
    return this.t[this.i++];
  }
}

/* ── inline ── */

function pushText(out: InlineNode[], value: string): void {
  if (!value) return;
  const last = out[out.length - 1];
  if (last?.type === 'text') last.value += value;
  else out.push({ type: 'text', value });
}

/** Convert inline children; stops at `close` (consumed) when given. */
function inlines(c: Cursor, close?: string): InlineNode[] {
  const out: InlineNode[] = [];
  while (!c.done) {
    const t = c.next();
    if (close && t.type === close) break;
    switch (t.type) {
      case 'text':
        pushText(out, t.content);
        break;
      case 'softbreak':
        pushText(out, ' ');
        break;
      case 'hardbreak':
        out.push({ type: 'lineBreak' });
        break;
      case 'strong_open':
        out.push({ type: 'strong', children: inlines(c, 'strong_close') });
        break;
      case 'em_open':
        out.push({ type: 'emphasis', children: inlines(c, 'em_close') });
        break;
      case 's_open':
        out.push({ type: 'strikethrough', children: inlines(c, 's_close') });
        break;
      case 'link_open':
        out.push({
          type: 'link',
          url: t.attrGet('href') || '',
          title: t.attrGet('title') || undefined,
          children: inlines(c, 'link_close'),
        });
        break;
      case 'code_inline':
        out.push({ type: 'inlineCode', value: t.content });
        break;
      case 'math_inline':
        out.push({ type: 'inlineMath', value: t.content });
        break;
      case 'image':
        out.push({ type: 'inlineImage', src: t.attrGet('src') || '', alt: t.content, title: t.attrGet('title') || undefined });
        break;
      case 'footnote_ref':
        out.push({ type: 'footnoteRef', id: String(t.meta.id + 1) });
        break;
      case 'sw_citation':
        for (const key of t.meta.keys as string[]) out.push({ type: 'citation', key: citationRealKey(key) });
        break;
      case 'sw_xref': {
        const { kind, ref, target } = t.meta;
        if (kind === 'eq') out.push({ type: 'equationRef', ref, display: target?.text });
        else out.push({ type: 'blockRef', ref: `${kind}:${ref}`, display: target?.text });
        break;
      }
      case 'sw_wikilink':
        out.push({ type: 'wikiLink', target: t.meta.target, display: t.meta.display });
        break;
      case 'sw_gloss':
        pushText(out, `${t.meta.base} (${t.meta.gloss})`);
        break;
      case 'html_inline':
        pushText(out, t.content);
        break;
      default:
        if (t.content) pushText(out, t.content);
    }
  }
  return out;
}

function inlineOf(token: Token | undefined): InlineNode[] {
  return token?.children ? inlines(new Cursor(token.children)) : [];
}

/* ── blocks ── */

function isOnlyImage(token: Token): Token | null {
  const kids = (token.children ?? []).filter((k) => !(k.type === 'text' && !k.content.trim()));
  return kids.length === 1 && kids[0].type === 'image' ? kids[0] : null;
}

function list(c: Cursor, open: Token): ListNode {
  const closeType = open.type.replace('_open', '_close');
  const items: ListItemNode[] = [];
  let tight = true;
  while (!c.done && c.peek().type !== closeType) {
    const t = c.next();
    if (t.type !== 'list_item_open') continue;
    if (c.peek()?.type === 'paragraph_open' && !c.peek().hidden) tight = false;
    const children = blocks(c, 'list_item_close');
    const item: ListItemNode = { type: 'listItem', children };
    // GitHub-style task item: "[ ] text" / "[x] text"
    const first = children[0];
    if (first?.type === 'paragraph' && first.children[0]?.type === 'text') {
      const m = /^\[([ xX])\]\s+/.exec(first.children[0].value);
      if (m) {
        item.checked = m[1] !== ' ';
        first.children[0].value = first.children[0].value.slice(m[0].length);
      }
    }
    items.push(item);
  }
  c.next(); // list close
  const start = open.attrGet('start');
  return {
    type: 'list',
    ordered: open.type === 'ordered_list_open',
    start: start ? Number(start) : open.type === 'ordered_list_open' ? 1 : undefined,
    tight,
    items,
  };
}

function align(t: Token): TableCellNode['align'] {
  const m = /text-align:\s*(left|center|right)/.exec(t.attrGet('style') || '');
  return m ? (m[1] as TableCellNode['align']) : undefined;
}

function table(c: Cursor, open: Token): TableNode {
  const header: TableRowNode[] = [];
  const body: TableRowNode[] = [];
  let section: TableRowNode[] = body;
  let row: TableRowNode | null = null;
  while (!c.done) {
    const t = c.next();
    if (t.type === 'table_close') break;
    if (t.type === 'thead_open') section = header;
    else if (t.type === 'tbody_open') section = body;
    else if (t.type === 'tr_open') {
      row = { type: 'tableRow', cells: [] };
      section.push(row);
    } else if ((t.type === 'th_open' || t.type === 'td_open') && row) {
      row.cells.push({ type: 'tableCell', children: inlineOf(c.next()), align: align(t) });
    }
  }
  const meta = open.meta?.table as { id: string; number: number; caption: string } | undefined;
  return {
    type: 'table',
    header,
    body,
    caption: meta?.caption || undefined,
    id: meta?.id,
    number: meta?.number,
  };
}

/** Convert block tokens until `close` (consumed) or the end. */
function blocks(c: Cursor, close?: string): BlockNode[] {
  const out: BlockNode[] = [];
  while (!c.done) {
    const t = c.next();
    if (close && t.type === close) break;

    switch (t.type) {
      case 'heading_open':
        out.push({ type: 'heading', level: Number(t.tag.slice(1)), children: inlineOf(c.next()) });
        c.next(); // heading_close
        break;

      case 'paragraph_open': {
        const inline = c.next();
        c.next(); // paragraph_close
        const img = isOnlyImage(inline);
        if (img) {
          const fig = img.meta?.figure as { id: string; number: number } | undefined;
          out.push({
            type: 'imageFigure',
            src: img.attrGet('src') || '',
            alt: img.content,
            title: img.attrGet('title') || undefined,
            caption: img.content || undefined,
            id: fig?.id,
            number: fig?.number,
          });
        } else {
          out.push({ type: 'paragraph', children: inlineOf(inline) });
        }
        break;
      }

      case 'hr':
        out.push({ type: 'thematicBreak' });
        break;

      case 'fence':
      case 'code_block': {
        const lang = t.info.trim().split(/\s+/)[0] || undefined;
        if (lang === 'poetry') out.push({ type: 'poetry', verses: parsePoem(t.content) });
        else out.push({ type: 'codeBlock', language: lang, value: t.content.replace(/\n$/, '') });
        break;
      }

      case 'math_block': {
        const eq = t.meta?.equation as { id: string; number: number } | undefined;
        out.push({ type: 'mathBlock', value: t.content.trim(), label: t.meta?.label, id: eq?.id, number: eq?.number });
        break;
      }

      case 'html_block':
        out.push({ type: 'htmlBlock', value: t.content });
        break;

      case 'blockquote_open':
        out.push({ type: 'blockquote', children: blocks(c, 'blockquote_close') });
        break;

      case 'bullet_list_open':
      case 'ordered_list_open':
        out.push(list(c, t));
        break;

      case 'table_open':
        out.push(table(c, t));
        break;

      case 'container_academic_open': {
        const a = t.meta?.academic as { id: string; type: string; number: number; label?: string } | undefined;
        out.push({
          type: 'academicBlock',
          blockType: a?.type ?? t.info.trim().split(/\s+/)[0],
          label: a?.label,
          id: a?.id,
          number: a?.number,
          children: blocks(c, 'container_academic_close'),
        });
        break;
      }

      case 'container_matn_open':
      case 'container_sharh_open':
      case 'container_hashiyah_open': {
        const kind = t.type.slice('container_'.length, -'_open'.length) as 'matn' | 'sharh' | 'hashiyah';
        out.push({ type: kind, children: blocks(c, `container_${kind}_close`) });
        break;
      }

      case 'footnote_block_open':
        while (!c.done && c.peek().type !== 'footnote_block_close') {
          const f = c.next();
          if (f.type === 'footnote_open') {
            out.push({ type: 'footnoteDefinition', id: String(f.meta.id + 1), children: blocks(c, 'footnote_close') });
          }
        }
        c.next();
        break;

      default:
        // Containers without their own node (e.g. :::page) contribute their children.
        if (t.type.startsWith('container_') && t.nesting === 1) {
          out.push(...blocks(c, t.type.replace(/_open$/, '_close')));
        }
    }
  }
  return out;
}

export function tokensToBlocks(tokens: Token[]): BlockNode[] {
  return blocks(new Cursor(tokens));
}
