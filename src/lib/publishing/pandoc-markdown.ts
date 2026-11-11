/**
 * DocumentModel → Pandoc Markdown (for DOCX/ODT/EPUB export).
 *
 * Exporters must not use the raw editor markdown: app syntax such as `[ref:…]`,
 * `:::` containers, poetry fences and wikilinks is resolved in the AST. This
 * renderer emits plain Pandoc Markdown and appends the registry `\newcommand`
 * header for `latex_macros`.
 */
import type { BlockNode, DocumentModel, InlineNode, TableRowNode } from './ast';
import { ensureBuiltinSymbols } from '../math';
import { expandPandocMacros, toPandocHeader } from '../math/to-pandoc';

function escapePandoc(s: string): string {
  return s.replace(/([\\`*_\[\]#$~^|])/g, '\\$1');
}

function yamlString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s*\n\s*/g, ' ');
}

function inline(nodes: InlineNode[]): string {
  let out = '';
  for (const n of nodes) {
    switch (n.type) {
      case 'text': out += escapePandoc(n.value); break;
      case 'strong': out += `**${inline(n.children)}**`; break;
      case 'emphasis': out += `*${inline(n.children)}*`; break;
      case 'strikethrough': out += `~~${inline(n.children)}~~`; break;
      case 'inlineCode': out += '`' + n.value.replace(/`/g, '\\`') + '`'; break;
      case 'link': out += `[${inline(n.children)}](${n.url})`; break;
      case 'inlineMath': out += `$${n.value}$`; break;
      case 'footnoteRef': out += `[^${n.id}]`; break;
      case 'citation': out += `[@${n.key}]`; break;
      case 'equationRef': out += escapePandoc(n.display ?? `(${n.ref})`); break;
      case 'blockRef': out += escapePandoc(n.display ?? `(${n.ref})`); break;
      case 'wikiLink': out += escapePandoc(n.display || n.target); break;
      case 'lineBreak': out += '\\\n'; break;
      case 'inlineImage': out += `![${escapePandoc(n.alt)}](${n.src})`; break;
    }
  }
  return out;
}

function table(header: TableRowNode[], body: TableRowNode[]): string {
  const first = header[0] ?? body[0];
  if (!first) return '';
  const cols = first.cells.length;
  const cell = (c: { children: InlineNode[] }) => inline(c.children);
  const row = (r: TableRowNode) => '| ' + r.cells.map(cell).join(' | ') + ' |';
  const head = header[0] ? row(header[0]) : '| ' + Array(cols).fill(' ').join(' | ') + ' |';
  const align = Array.from({ length: cols }, (_, i) => {
    const a = first.cells[i]?.align;
    return a === 'center' ? ':---:' : a === 'right' ? '---:' : '---';
  });
  const lines = [head, '| ' + align.join(' | ') + ' |'];
  for (const r of body) lines.push(row(r));
  return lines.join('\n') + '\n\n';
}

function block(node: BlockNode): string {
  switch (node.type) {
    case 'heading':
      return `${'#'.repeat(Math.min(node.level, 6))} ${inline(node.children)}\n\n`;
    case 'paragraph':
      return `${inline(node.children)}\n\n`;
    case 'thematicBreak':
      return '---\n\n';
    case 'codeBlock': {
      const fence = node.value.includes('```') ? '~~~' : '```';
      return `${fence}${node.language || ''}\n${node.value}\n${fence}\n\n`;
    }
    case 'blockquote':
      return blocks(node.children)
        .trimEnd()
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n') + '\n\n';
    case 'list': {
      let out = '';
      let n = node.start ?? 1;
      for (const item of node.items) {
        const marker = node.ordered ? `${n++}. ` : '- ';
        out += marker + blocks(item.children).trim().replace(/\n/g, '\n  ') + '\n';
      }
      return out + '\n';
    }
    case 'imageFigure': {
      const id = node.id ? `{#${node.id}}` : '';
      return `![${escapePandoc(node.caption || node.alt)}](${node.src})${id}\n\n`;
    }
    case 'table':
      return table(node.header, node.body);
    case 'mathBlock':
      return `$$\n${node.value}\n$$\n\n`;
    case 'footnoteDefinition':
      return `[^${node.id}]: ${blocks(node.children).trim().replace(/\n/g, '\n    ')}\n\n`;
    case 'poetry':
      return node.verses
        .map((v) => `${escapePandoc(v.sadr)}${v.ajuz ? ` \\\\ ${escapePandoc(v.ajuz)}` : ''}\\\\`)
        .join('\n') + '\n\n';
    case 'academicBlock':
    case 'matn':
    case 'sharh':
    case 'hashiyah':
    case 'figureGroup':
      return blocks(node.children);
    case 'htmlBlock':
      return '';
  }
  return '';
}

function blocks(nodes: BlockNode[]): string {
  return nodes.map(block).join('');
}

export function documentToPandocMarkdown(model: DocumentModel): string {
  ensureBuiltinSymbols();
  const rtl = model.meta.direction === 'rtl' || model.meta.lang === 'ar';
  const rawBody = blocks(model.blocks);
  const header = toPandocHeader(rawBody);
  // Pandoc's latex_macros does not expand macros inside display math, so do it
  // ourselves before handing the document to Pandoc.
  const body = expandPandocMacros(rawBody);
  const yaml = [
    '---',
    `title: "${yamlString(model.meta.title || '')}"`,
  ];
  if (model.meta.author) yaml.push(`author: "${yamlString(model.meta.author)}"`);
  if (model.meta.date) yaml.push(`date: "${yamlString(model.meta.date)}"`);
  yaml.push(
    `lang: ${model.meta.lang || 'ar'}`,
    `dir: ${rtl ? 'rtl' : 'ltr'}`,
    `mainfont: "${yamlString(model.meta.arabicFont || 'Amiri')}"`,
    '---',
  );
  return yaml.join('\n') + '\n\n' + (header ? header + '\n\n' : '') + body;
}
