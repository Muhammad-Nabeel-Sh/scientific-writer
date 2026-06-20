import type { Exporter, ExportResult } from './exporter';
import type { DocumentModel, BlockNode, InlineNode, TableRowNode } from './ast';

function renderInline(nodes: InlineNode[]): string {
  let out = '';
  for (const n of nodes) {
    switch (n.type) {
      case 'text': out += n.value; break;
      case 'strong': out += `**${renderInline(n.children)}**`; break;
      case 'emphasis': out += `*${renderInline(n.children)}*`; break;
      case 'strikethrough': out += `~~${renderInline(n.children)}~~`; break;
      case 'inlineCode': out += `\`${n.value}\``; break;
      case 'link': out += `[${renderInline(n.children)}](${n.url}${n.title ? ` "${n.title}"` : ''})`; break;
      case 'inlineMath': out += `$${n.value}$`; break;
      case 'footnoteRef': out += `[^${n.id}]`; break;
      case 'citation': out += `[@${n.key}]`; break;
      case 'equationRef': out += `(${n.ref})`; break;
      case 'blockRef': out += `(${n.ref})`; break;
      case 'wikiLink': out += `[[${n.target}${n.display ? `|${n.display}` : ''}]]`; break;
      case 'lineBreak': out += '\\\n'; break;
      case 'inlineImage': out += `![${n.alt}](${n.src}${n.title ? ` "${n.title}"` : ''})`; break;
    }
  }
  return out;
}

function renderBlocks(blocks: BlockNode[], indent = ''): string {
  let out = '';
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        out += `${'#'.repeat(block.level)} ${renderInline(block.children)}\n\n`;
        break;
      case 'paragraph':
        out += `${renderInline(block.children)}\n\n`;
        break;
      case 'thematicBreak':
        out += `---\n\n`;
        break;
      case 'codeBlock':
        out += '```' + (block.language || '') + '\n' + block.value + '\n```\n\n';
        break;
      case 'blockquote':
        out += block.children.map(c => `> ${renderBlocks([c]).trim()}`).join('\n> ') + '\n\n';
        break;
      case 'list':
        for (const item of block.items) {
          const prefix = block.ordered ? `${block.start || 1}. ` : '- ';
          const content = renderBlocks(item.children, indent + '  ');
          out += `${indent}${prefix}${content.replace(/\n/g, `\n${indent}  `)}\n`;
        }
        out += '\n';
        break;
      case 'imageFigure':
        out += `![${block.alt}](${block.src}${block.title ? ` "${block.title}"` : ''})\n`;
        if (block.caption) out += `*${block.caption}*\n`;
        out += '\n';
        break;
      case 'table':
        out += renderTable(block.header, block.body);
        if (block.caption) out += `\n*${block.caption}*\n`;
        out += '\n';
        break;
      case 'mathBlock':
        out += `$$\n${block.value}\n$${block.number != null ? ` (${block.number})` : ''}\n\n`;
        break;
      case 'footnoteDefinition':
        out += `[^${block.id}]: ${renderBlocks(block.children).trim().replace(/\n\s*/g, ' ')}\n\n`;
        break;
      case 'poetry':
        for (const v of block.verses) {
          out += `> ${v.sadr}${v.ajuz ? `\n> ${v.ajuz}` : ''}\n`;
        }
        out += '\n';
        break;
      case 'htmlBlock':
        out += block.value + '\n\n';
        break;
      case 'academicBlock':
      case 'matn':
      case 'sharh':
      case 'hashiyah':
      case 'figureGroup':
        if ('children' in block) {
          out += renderBlocks((block as any).children as BlockNode[], indent);
        }
        break;
    }
  }
  return out;
}

function renderTable(header: TableRowNode[], body: TableRowNode[]): string {
  if (!header.length && !body.length) return '';
  const cols = header.length ? header[0].cells.length : body[0].cells.length;
  const hdr = header.length ? '| ' + header[0].cells.map(c => renderInline(c.children)).join(' | ') + ' |' : '';
  const sep = '| ' + Array(cols).fill('---').join(' | ') + ' |';
  const rows = body.map(r => '| ' + r.cells.map(c => renderInline(c.children)).join(' | ') + ' |').join('\n');
  return `${hdr}\n${sep}\n${rows}\n`;
}

export class MarkdownExporter implements Exporter {
  readonly name = 'markdown';
  readonly label = 'ماركداون';
  readonly extensions = ['md'];

  export(model: DocumentModel): ExportResult {
    const header = `---\ntitle: "${model.meta.title || ''}"\nauthor: "${model.meta.author || ''}"\ndate: "${model.meta.date || ''}"\nlang: ${model.meta.lang || 'ar'}\ndir: ${model.meta.direction || 'rtl'}\n---\n\n`;
    const body = renderBlocks(model.blocks);
    return { content: header + body, extension: 'md', mime: 'text/markdown' };
  }
}
