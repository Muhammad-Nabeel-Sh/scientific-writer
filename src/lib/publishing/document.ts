import type { BibEntry } from '../bibliography';
import {
  type BlockNode,
  type InlineNode,
  type DocumentModel,
  type DocumentMeta,
  type TableRowNode,
  type TableCellNode,
  type ListItemNode,
  type PoetryVerse,
} from './ast';

/* ── Helpers ── */

const THEMATIC_BREAK_RE = /^(?:[-*_]){3,}\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const CODE_FENCE_RE = /^(`{3,}|~{3,})(\S*)/;
const BLOCKQUOTE_RE = /^ {0,3}(?:> ?(.*))$/;
const UNORDERED_LIST_RE = /^ {0,3}([-*+])[ \t](.+)$/;
const ORDERED_LIST_RE = /^ {0,3}(\d+)\.([ \t].*)$/;
const TABLE_ROW_RE = /^ {0,3}\|.*\|.*$/;
const TABLE_SEP_RE = /^ {0,3}\|[\s:-]+\|/;
const IMAGE_RE = /^ {0,3}!\[([^\]]*)\]\(([^)]+)\)\s*$/;
const MATH_BLOCK_RE = /^\$\$$/;
const POETRY_FENCE_RE = /^(`{3,}|~{3,})\s*poetry\s*$/;
const ACADEMIC_FENCE_OPEN_RE = /^ {0,3}:::\s*(\w+)(?:\s+(\S+))?/;
const ACADEMIC_FENCE_CLOSE_RE = /^ {0,3}:::\s*$/;
const CLASSICAL_CONTAINER_OPEN_RE = /^ {0,3}:::\s*(matn|sharh|hashiyah|page)\s*$/;
const HTML_BLOCK_RE = /^<[a-zA-Z\/!]/;
const HR_RE = /^ {0,3}(?:[-*_]){3,}\s*$/;

/* ── Inline parser ── */

// Order matters: longer delimiters before shorter ones
const INLINE_RULES: [RegExp, (m: RegExpExecArray) => InlineNode | null][] = [
  // Escaped chars
  [/\\([\\`*_{}\[\]()#+\-.!|~<>])/, (m) => ({ type: 'text', value: m[1] })],
  // Wiki link [[target|display]] or [[target]]
  [/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/, (m) => ({
    type: 'wikiLink', target: m[1].trim(), display: m[2]?.trim(),
  })],
  // Citation [@key]
  [/\[@([^\]]+)\]/, (m) => ({ type: 'citation', key: m[1].trim() })],
  // Equation ref [ref:eq:...]
  [/\[ref:eq:([^\]]+)\]/, (m) => ({ type: 'equationRef', ref: m[1] })],
  // Block ref [ref:type:...]
  [/\[ref:(\w+):([^\]]+)\]/, (m) => ({ type: 'blockRef', ref: `${m[1]}:${m[2]}` })],
  // Footnote ref [^N]
  [/\[\^(\d+)\]/, (m) => ({ type: 'footnoteRef', id: m[1] })],
  // Image ![alt](src)
  [/!\[([^\]]*)\]\(([^)]+)\)/, (m) => ({
    type: 'inlineImage', src: m[2], alt: m[1],
  })],
  // Link [text](url)
  [/\[([^\]]*)\]\(([^)]+)\)/, (m) => ({
    type: 'link', url: m[2], children: parseInline(m[1]),
  })],
  // Strong **text** or __text__
  [/\*\*(.+?)\*\*/, (m) => ({
    type: 'strong', children: parseInline(m[1]),
  })],
  [/(?<!\*)\b__(.+?)__(?!\*)/, (m) => ({
    type: 'strong', children: parseInline(m[1]),
  })],
  // Emphasis *text* or _text_
  [/\*(.+?)\*/, (m) => ({
    type: 'emphasis', children: parseInline(m[1]),
  })],
  [/(?<![*_])\b_(.+?)_\b/, (m) => ({
    type: 'emphasis', children: parseInline(m[1]),
  })],
  // Strikethrough ~~text~~
  [/~~(.+?)~~/, (m) => ({
    type: 'strikethrough', children: parseInline(m[1]),
  })],
  // Inline code `code`
  [/`([^`]+)`/, (m) => ({ type: 'inlineCode', value: m[1] })],
  // Inline math $...$
  [/\$(.+?)\$/, (m) => ({ type: 'inlineMath', value: m[1] })],
  // Line break (two trailing spaces or backslash)
  [/  \n/, () => ({ type: 'lineBreak' })],
  [/\\\n/, () => ({ type: 'lineBreak' })],
];

export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let pos = 0;

  while (pos < text.length) {
    let matched = false;
    for (const [re, handler] of INLINE_RULES) {
      re.lastIndex = 0;
      const m = re.exec(text.slice(pos));
      if (m && m.index === 0) {
        const node = handler(m);
        if (node) nodes.push(node);
        pos += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Accumulate plain text until the next potential match
      let end = pos + 1;
      while (end <= text.length) {
        let willMatch = false;
        for (const [re] of INLINE_RULES) {
          re.lastIndex = 0;
          const m = re.exec(text.slice(end - 1));
          if (m && m.index === 0) {
            willMatch = true;
            break;
          }
        }
        if (willMatch) break;
        end++;
      }
      // Also stop at newlines for line break detection
      const nlIdx = text.indexOf('\n', pos);
      if (nlIdx >= 0 && nlIdx < end) end = nlIdx;

      const value = text.slice(pos, end).replace(/\n/g, ' ');
      if (value) {
        // Merge consecutive text nodes
        const last = nodes[nodes.length - 1];
        if (last?.type === 'text') {
          (last as { type: 'text'; value: string }).value += value;
        } else {
          nodes.push({ type: 'text', value });
        }
      }
      pos = end;
    }
  }

  return nodes;
}

/* ── Block-level state machine ── */

type Container =
  | { type: 'blockquote'; children: BlockNode[] }
  | { type: 'list'; ordered: boolean; start?: number; tight: boolean; children: BlockNode[]; items: ListItemNode[] }
  | { type: 'academicBlock'; blockType: string; label?: string; children: BlockNode[] }
  | { type: 'matn'; children: BlockNode[] }
  | { type: 'sharh'; children: BlockNode[] }
  | { type: 'hashiyah'; children: BlockNode[] };

interface ParseState {
  blocks: BlockNode[];
  containerStack: Container[];
  inFence: boolean;
  fenceLang: string;
  fenceContent: string[];
  inPoetry: boolean;
  poetryContent: string[];
  inMathBlock: boolean;
  mathContent: string[];
  footnoteDefs: Map<string, BlockNode[]>;
  errors: string[];
}

function pushBlock(state: ParseState, block: BlockNode): void {
  if (state.containerStack.length > 0) {
    const top = state.containerStack[state.containerStack.length - 1];
    top.children.push(block);
  } else {
    state.blocks.push(block);
  }
}

function closeContainersUntil(state: ParseState, type: string): void {
  while (state.containerStack.length > 0) {
    const top = state.containerStack[state.containerStack.length - 1];
    if (top.type === type) break;
    const container = state.containerStack.pop()!;
    if (container.type === 'blockquote') {
      pushBlock(state, { type: 'blockquote', children: container.children });
    } else if (container.type === 'list') {
      pushBlock(state, {
        type: 'list',
        ordered: container.ordered,
        start: container.start,
        tight: container.tight,
        items: container.items,
      });
    }
  }
}

function closeContainer(state: ParseState): void {
  const container = state.containerStack.pop();
  if (!container) return;
  if (container.type === 'blockquote') {
    pushBlock(state, { type: 'blockquote', children: container.children });
  } else if (container.type === 'list') {
    pushBlock(state, {
      type: 'list',
      ordered: container.ordered,
      start: container.start,
      tight: container.tight,
      items: container.items,
    });
  } else if (container.type === 'academicBlock') {
    pushBlock(state, {
      type: 'academicBlock',
      blockType: container.blockType,
      label: container.label,
      children: container.children,
    });
  } else if (container.type === 'matn') {
    pushBlock(state, { type: 'matn', children: container.children });
  } else if (container.type === 'sharh') {
    pushBlock(state, { type: 'sharh', children: container.children });
  } else if (container.type === 'hashiyah') {
    pushBlock(state, { type: 'hashiyah', children: container.children });
  }
}

function tryParseFootnote(line: string): { id: string; content: string } | null {
  const m = line.match(/^ {0,3}\[\^(\d+)\]:\s*(.*)/);
  if (!m) return null;
  return { id: m[1], content: m[2] };
}

function tryParseTableRow(line: string): TableRowNode | null {
  const cells = line.split('|').slice(1, -1);
  if (cells.length === 0) return null;
  return {
    type: 'tableRow',
    cells: cells.map((c) => ({
      type: 'tableCell',
      children: parseInline(c.trim()),
    })),
  };
}

function tryParseTableSep(line: string): string[] | null {
  const cells = line.split('|').slice(1, -1);
  const aligns = cells.map((c) => c.trim());
  if (aligns.every((a) => /^:?-+:?$/.test(a))) return aligns;
  return null;
}

/* ── Main entry point ── */

export function parseDocument(markdown: string, bibEntries: BibEntry[] = []): DocumentModel {
  const lines = markdown.split('\n');
  const state: ParseState = {
    blocks: [],
    containerStack: [],
    inFence: false,
    fenceLang: '',
    fenceContent: [],
    inPoetry: false,
    poetryContent: [],
    inMathBlock: false,
    mathContent: [],
    footnoteDefs: new Map(),
    errors: [],
  };

  // Table parsing state
  let inTable = false;
  let tableHeader: TableRowNode[] = [];
  let tableBody: TableRowNode[] = [];
  let tableCaption = '';

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw;

    // ── Code fence ──
    if (!state.inPoetry && !state.inMathBlock && !inTable) {
      const fenceM = line.match(CODE_FENCE_RE);
      if (fenceM) {
        if (!state.inFence) {
          state.inFence = true;
          state.fenceLang = fenceM[2];
          state.fenceContent = [];
          continue;
        } else {
          state.inFence = false;
          pushBlock(state, {
            type: 'codeBlock',
            language: state.fenceLang || undefined,
            value: state.fenceContent.join('\n'),
          });
          state.fenceLang = '';
          state.fenceContent = [];
          continue;
        }
      }
    }

    if (state.inFence) {
      state.fenceContent.push(line);
      continue;
    }

    // ── Poetry fence ──
    if (!state.inFence && !state.inMathBlock && !inTable) {
      const poetM = line.match(POETRY_FENCE_RE);
      if (poetM) {
        if (!state.inPoetry) {
          state.inPoetry = true;
          state.poetryContent = [];
          continue;
        } else {
          state.inPoetry = false;
          const verses: PoetryVerse[] = state.poetryContent
            .filter((l) => l.trim())
            .map((l) => {
              const parts = l.split('||');
              if (parts.length >= 2) {
                return { sadr: parts[0].trim(), ajuz: parts[1].trim() };
              }
              return { sadr: l.trim(), ajuz: undefined };
            });
          if (verses.length > 0) {
            pushBlock(state, { type: 'poetry', verses });
          }
          continue;
        }
      }
    }

    if (state.inPoetry) {
      state.poetryContent.push(line);
      continue;
    }

    // ── Math block ($$) ──
    if (!state.inFence && !state.inPoetry && !inTable) {
      if (line.trim() === '$$') {
        if (!state.inMathBlock) {
          state.inMathBlock = true;
          state.mathContent = [];
          continue;
        } else {
          state.inMathBlock = false;
          const math = state.mathContent.join('\n').trim();
          // Check for label {#eq:label}
          const labelM = math.match(/\{#eq:(\w+)\}\s*$/);
          const value = labelM ? math.slice(0, labelM.index).trim() : math;
          pushBlock(state, {
            type: 'mathBlock',
            value,
            label: labelM ? labelM[1] : undefined,
          });
          state.mathContent = [];
          continue;
        }
      }
    }

    if (state.inMathBlock) {
      state.mathContent.push(line);
      continue;
    }

    // ── Thematic break / horizontal rule ──
    if (!inTable && HR_RE.test(line)) {
      pushBlock(state, { type: 'thematicBreak' });
      continue;
    }

    // ── Table ──
    if (!inTable && TABLE_ROW_RE.test(line)) {
      const sepM = i + 1 < lines.length ? lines[i + 1].match(TABLE_SEP_RE) : null;
      if (sepM) {
        inTable = true;
        const aligns = tryParseTableSep(lines[i + 1]);
        const headerRow = tryParseTableRow(line);
        if (headerRow && aligns) {
          headerRow.cells.forEach((cell, ci) => {
            if (aligns[ci] === ':---') cell.align = 'left';
            else if (aligns[ci] === '---:') cell.align = 'right';
            else if (aligns[ci] === ':---:') cell.align = 'center';
          });
        }
        if (headerRow) tableHeader = [headerRow];
        i += 2; // skip header and separator
        tableBody = [];
        // Check for caption on the line before the table
        if (i >= 2) {
          const prevLine = lines[i - 3] || '';
          const capM = prevLine.match(/^(?:Table|جدول):\s*(.*)/);
          if (capM) tableCaption = capM[1].trim();
        }
        continue;
      }
    }

    if (inTable) {
      if (TABLE_ROW_RE.test(line)) {
        const row = tryParseTableRow(line);
        if (row) tableBody.push(row);
        continue;
      } else {
        inTable = false;
        pushBlock(state, {
          type: 'table',
          header: tableHeader,
          body: tableBody,
          caption: tableCaption || undefined,
        });
        tableHeader = [];
        tableBody = [];
        tableCaption = '';
        // Fall through to process this line as a normal block
      }
    }

    // ── Academic block fence (::: type) ──
    if (!inTable) {
      const acOpenM = line.match(ACADEMIC_FENCE_OPEN_RE);
      if (acOpenM && !CLASSICAL_CONTAINER_OPEN_RE.test(line)) {
        state.containerStack.push({
          type: 'academicBlock',
          blockType: acOpenM[1],
          label: acOpenM[2] || undefined,
          children: [],
        });
        continue;
      }
      const acCloseM = line.match(ACADEMIC_FENCE_CLOSE_RE);
      if (acCloseM && state.containerStack.length > 0) {
        const top = state.containerStack[state.containerStack.length - 1];
        if (top.type === 'academicBlock' || top.type === 'matn' || top.type === 'sharh' || top.type === 'hashiyah') {
          closeContainer(state);
          continue;
        }
        closeContainersUntil(state, 'blockquote');
        if (state.containerStack.length > 0) {
          closeContainer(state);
          continue;
        }
      }
    }

    // ── Classical book containers (:::matn, :::sharh, :::hashiyah, :::page) ──
    if (!inTable) {
      const ccM = line.match(CLASSICAL_CONTAINER_OPEN_RE);
      if (ccM) {
        const type = ccM[1] as 'matn' | 'sharh' | 'hashiyah' | 'page';
        if (type === 'page') {
          // :::page wraps everything until next :::page — for now, treat as transparent
          continue;
        }
        state.containerStack.push({ type, children: [] });
        continue;
      }
    }

    // ── Heading ──
    if (!inTable) {
      const hM = line.match(HEADING_RE);
      if (hM) {
        pushBlock(state, {
          type: 'heading',
          level: hM[1].length,
          children: parseInline(hM[2]),
        });
        continue;
      }
    }

    // ── Image figure (standalone ![]()) ──
    if (!inTable) {
      const imgM = line.match(IMAGE_RE);
      if (imgM) {
        pushBlock(state, {
          type: 'imageFigure',
          src: imgM[2],
          alt: imgM[1],
        });
        continue;
      }
    }

    // ── Blockquote ──
    if (!inTable) {
      const bqM = line.match(BLOCKQUOTE_RE);
      if (bqM) {
        closeContainersUntil(state, 'blockquote');
        if (state.containerStack.length === 0 || state.containerStack[state.containerStack.length - 1].type !== 'blockquote') {
          state.containerStack.push({ type: 'blockquote', children: [] });
        }
        const content = bqM[1];
        if (content) {
          // Parse content as inline within a paragraph
          pushBlock(state, { type: 'paragraph', children: parseInline(content) });
        }
        continue;
      } else {
        // Non-blockquote line closes blockquote
        if (state.containerStack.length > 0 && state.containerStack[state.containerStack.length - 1].type === 'blockquote') {
          closeContainer(state);
        }
      }
    }

    // ── Footnote definition ──
    if (!inTable) {
      const fnM = tryParseFootnote(line);
      if (fnM) {
        // Collect subsequent indented lines as footnote content
        const fnContent: string[] = [fnM.content];
        let j = i + 1;
        while (j < lines.length && /^ {2,}/.test(lines[j])) {
          fnContent.push(lines[j].trim());
          j++;
        }
        state.footnoteDefs.set(fnM.id, [
          { type: 'paragraph', children: parseInline(fnContent.join(' ')) },
        ]);
        if (j > i + 1) i = j - 1;
        continue;
      }
    }

    // ── List ──
    if (!inTable) {
      const ulM = line.match(UNORDERED_LIST_RE);
      const olM = line.match(ORDERED_LIST_RE);
      if (ulM || olM) {
        const marker = ulM ? ulM[1] : olM![1];
        const content = ulM ? ulM[2] : olM![2];
        const ordered = !!olM;

        closeContainersUntil(state, 'list');

        let listContainer = state.containerStack[state.containerStack.length - 1];
        if (!listContainer || listContainer.type !== 'list') {
          listContainer = { type: 'list', ordered, start: ordered ? parseInt(marker) : undefined, tight: true, children: [], items: [] };
          state.containerStack.push(listContainer);
        }

        (listContainer as { type: 'list'; items: ListItemNode[] }).items.push({
          type: 'listItem',
          children: [{ type: 'paragraph', children: parseInline(content.trim()) }],
        });
        continue;
      } else if (state.containerStack.length > 0 && state.containerStack[state.containerStack.length - 1].type === 'list') {
        // Close list on non-list line
        closeContainer(state);
      }
    }

    // ── HTML block ──
    if (!inTable) {
      if (HTML_BLOCK_RE.test(line)) {
        const htmlLines: string[] = [line];
        let j = i + 1;
        while (j < lines.length && !lines[j].trim().startsWith('</') && !lines[j].trim().startsWith('<')) {
          htmlLines.push(lines[j]);
          j++;
        }
        if (j < lines.length) htmlLines.push(lines[j]);
        pushBlock(state, { type: 'htmlBlock', value: htmlLines.join('\n') });
        i = j;
        continue;
      }
    }

    // ── Paragraph (default) ──
    if (line.trim()) {
      // Collect paragraph lines until a blank line or block-level marker
      const paraLines: string[] = [line];
      let j = i + 1;
      while (
        j < lines.length &&
        lines[j].trim() &&
        !HEADING_RE.test(lines[j]) &&
        !HR_RE.test(lines[j]) &&
        !CODE_FENCE_RE.test(lines[j]) &&
        !BLOCKQUOTE_RE.test(lines[j]) &&
        !UNORDERED_LIST_RE.test(lines[j]) &&
        !ORDERED_LIST_RE.test(lines[j]) &&
        !TABLE_ROW_RE.test(lines[j]) &&
        !IMAGE_RE.test(lines[j]) &&
        !ACADEMIC_FENCE_OPEN_RE.test(lines[j]) &&
        !CLASSICAL_CONTAINER_OPEN_RE.test(lines[j]) &&
        line.trim() !== '$$'
      ) {
        paraLines.push(lines[j]);
        j++;
      }
      pushBlock(state, { type: 'paragraph', children: parseInline(paraLines.join(' ')) });
      if (j > i + 1) i = j - 1;
      continue;
    }
  }

  // Close any remaining open fences/containers
  if (state.inFence) {
    pushBlock(state, { type: 'codeBlock', language: state.fenceLang || undefined, value: state.fenceContent.join('\n') });
  }
  if (state.inPoetry && state.poetryContent.length > 0) {
    const verses: PoetryVerse[] = state.poetryContent
      .filter((l) => l.trim())
      .map((l) => {
        const parts = l.split('||');
        if (parts.length >= 2) return { sadr: parts[0].trim(), ajuz: parts[1].trim() };
        return { sadr: l.trim(), ajuz: undefined };
      });
    if (verses.length > 0) pushBlock(state, { type: 'poetry', verses });
  }
  if (state.inMathBlock) {
    pushBlock(state, { type: 'mathBlock', value: state.mathContent.join('\n').trim() });
  }
  if (inTable) {
    pushBlock(state, { type: 'table', header: tableHeader, body: tableBody, caption: tableCaption || undefined });
  }
  while (state.containerStack.length > 0) {
    closeContainer(state);
  }

  // Resolve footnote definitions (attach to paragraph nodes that reference them)
  // For now, footnote defs are stored but not inlined into the block stream

  // Extract metadata from first heading if present
  const meta: DocumentMeta = {};
  if (state.blocks.length > 0 && state.blocks[0].type === 'heading' && state.blocks[0].level === 1) {
    const text = state.blocks[0].children.map((c) => (c.type === 'text' ? c.value : '')).join('');
    meta.title = text;
  }

  return {
    meta,
    blocks: state.blocks,
    bibEntries,
    errors: state.errors,
  };
}

/**
 * Convenience: create a DocumentModel from markdown text.
 */
export function createDocument(markdown: string, bibEntries?: BibEntry[]): DocumentModel {
  return parseDocument(markdown, bibEntries ?? []);
}
