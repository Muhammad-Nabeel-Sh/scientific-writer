import type { Exporter, ExportResult } from './exporter';
import type { DocumentModel, BlockNode, InlineNode, TableRowNode } from './ast';
import type { BibEntry } from '../bibliography';

function escapeTypst(s: string): string {
  return s.replace(/[#$@{}[\]&_~^|*\\]/g, m => `\\${m}`);
}

function renderInline(nodes: InlineNode[]): string {
  let out = '';
  for (const n of nodes) {
    switch (n.type) {
      case 'text': out += escapeTypst(n.value); break;
      case 'strong': out += `*${renderInline(n.children)}*`; break;
      case 'emphasis': out += `_${renderInline(n.children)}_`; break;
      case 'strikethrough': out += `~~${renderInline(n.children)}~~`; break;
      case 'inlineCode': out += `\`${n.value}\``; break;
      case 'link': out += `#link("${n.url}")[${renderInline(n.children)}]`; break;
      case 'inlineMath': out += `$${n.value}$`; break;
      case 'footnoteRef': out += `#footnote[${n.id}]`; break;
      case 'citation': out += `@${n.key}`; break;
      case 'equationRef': out += `(${n.ref})`; break;
      case 'blockRef': out += `(${n.ref})`; break;
      case 'wikiLink': out += escapeTypst(n.display || n.target); break;
      case 'lineBreak': out += `\\ `; break;
      case 'inlineImage': out += `#image("${n.src}")`; break;
    }
  }
  return out;
}

function renderBlocks(blocks: BlockNode[]): string {
  let out = '';
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        out += `${'='.repeat(block.level)} ${renderInline(block.children)}\n\n`;
        break;
      case 'paragraph':
        out += `${renderInline(block.children)}\n\n`;
        break;
      case 'thematicBreak':
        out += `---\n\n`;
        break;
      case 'codeBlock':
        out += '```' + (block.language || '') + '\n' + block.value + '\n' + '```\n\n';
        break;
      case 'blockquote':
        out += block.children.map(c => renderBlocks([c]).trim().split('\n').map(l => `  ${l}`).join('\n')).join('\n') + '\n\n';
        break;
      case 'list':
        for (const item of block.items) {
          const prefix = block.ordered ? `${block.start || 1}. ` : '- ';
          out += `${prefix}${renderBlocks(item.children).trim().replace(/\n/g, '\n  ')}\n`;
        }
        out += '\n';
        break;
      case 'imageFigure':
        out += `#figure(\n  image("${block.src}", width: 80%),\n  caption: [${escapeTypst(block.caption || block.alt)}],\n)\n\n`;
        break;
      case 'table':
        out += renderTable(block.header, block.body);
        break;
      case 'mathBlock':
        out += `$${block.value}${block.number != null ? ` $ (${block.number})` : ''}$\n\n`;
        break;
      case 'footnoteDefinition':
        out += `${renderBlocks(block.children).trim()}\n\n`;
        break;
      case 'poetry':
        for (const v of block.verses) {
          out += `  ${v.sadr}${v.ajuz ? ` \\\\  ${v.ajuz}` : ''}\n`;
        }
        out += '\n';
        break;
      case 'academicBlock':
      case 'matn':
      case 'sharh':
      case 'hashiyah':
      case 'figureGroup':
        if ('children' in block) out += renderBlocks((block as any).children as BlockNode[]);
        break;
      case 'htmlBlock':
        break;
    }
  }
  return out;
}

function renderTable(header: TableRowNode[], body: TableRowNode[]): string {
  if (!header.length && !body.length) return '';
  const cols = header.length ? header[0].cells.length : body[0].cells.length;
  const hdr = header.length ? header[0].cells.map(c => renderInline(c.children)).join(', ') : '';
  const rows = body.map(r => r.cells.map(c => renderInline(c.children)).join(', ')).join('\n');
  let out = `#table(\n  columns: ${cols},\n`;
  if (header.length) out += `  header: true,\n`;
  out += `  ${hdr ? `[${hdr}], ` : ''}${rows.split('\n').map(l => `[${l}],`).join('\n  ')}\n)\n\n`;
  return out;
}

function renderBibliography(entries: BibEntry[]): string {
  if (!entries.length) return '';
  let out = `#bibliography(\n  title: "المراجع",\n  entries: (\n`;
  for (const e of entries) {
    out += `    "${e.key}": (\n`;
    if (e.fields.author) out += `      author: "${e.fields.author}",\n`;
    if (e.fields.title) out += `      title: "${e.fields.title}",\n`;
    if (e.fields.year) out += `      date: "${e.fields.year}",\n`;
    out += `    ),\n`;
  }
  out += `  )\n)\n`;
  return out;
}

export class TypstExporter implements Exporter {
  readonly name = 'typst';
  readonly label = 'Typst';
  readonly extensions = ['typ'];

  export(model: DocumentModel): ExportResult {
    const rtl = model.meta.direction === 'rtl' || model.meta.lang === 'ar';
    const header = `#set page(a4, margin: 2.5cm)\n#set text(font: "Traditional Arabic", lang: "${model.meta.lang || 'ar'}", dir: ${rtl ? '"rtl"' : '"ltr"'})\n#set par(justify: true)\n\n`;
    const meta = model.meta.title ? `= ${escapeTypst(model.meta.title)}\n\n` : '';
    const body = renderBlocks(model.blocks);
    const bib = renderBibliography(model.bibEntries);
    return { content: `${header}${meta}${body}${bib}`, extension: 'typ', mime: 'text/plain' };
  }
}
