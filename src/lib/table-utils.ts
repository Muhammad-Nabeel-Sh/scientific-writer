export interface CellData {
  text: string;
  colspan?: number;
  rowspan?: number;
}

export interface ParsedTable {
  header: CellData[];
  body: CellData[][];
  align: ('left' | 'center' | 'right')[];
  caption: string;
  hasRowHeaders: boolean;
  autoNumber: boolean;
  colWidths: (number | undefined)[];
}

function isTableLine(line: string): boolean {
  return line.trimStart().startsWith('|') && line.includes('|', 1);
}

function parseAlign(sep: string): 'left' | 'center' | 'right' {
  if (sep.startsWith(':') && sep.endsWith(':')) return 'center';
  if (sep.endsWith(':')) return 'right';
  return 'left';
}

export function extractTableAt(text: string, cursorPos: number): { start: number; end: number; table: ParsedTable } | null {
  const lines = text.split('\n');
  let lineIdx = 0;
  const lineStarts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    lineStarts.push(lineIdx);
    lineIdx += lines[i].length + 1;
  }

  let cursorLine = 0;
  let acc = 0;
  for (let i = 0; i < lines.length; i++) {
    if (cursorPos >= acc && cursorPos <= acc + lines[i].length) {
      cursorLine = i;
      break;
    }
    acc += lines[i].length + 1;
  }

  let tableStartLine = cursorLine;
  while (tableStartLine > 0 && isTableLine(lines[tableStartLine - 1])) {
    tableStartLine--;
  }
  if (!isTableLine(lines[tableStartLine])) return null;

  let tableEndLine = cursorLine;
  while (tableEndLine < lines.length - 1 && isTableLine(lines[tableEndLine + 1])) {
    tableEndLine++;
  }

  const tableLines = lines.slice(tableStartLine, tableEndLine + 1);
  if (tableLines.length < 2) return null;

  const sepLine = tableLines[1];
  const seps = sepLine.split('|').slice(1, -1).map(s => s.trim());
  if (!seps.every(s => /^:?-+:?$/.test(s))) return null;

  const align = seps.map(parseAlign);

  const header = tableLines[0].split('|').slice(1, -1).map(s => ({ text: s.trim() }));
  const body = tableLines.slice(2).map(row =>
    row.split('|').slice(1, -1).map(s => ({ text: s.trim() }))
  );

  let caption = '';
  if (tableStartLine > 0) {
    const prevLine = lines[tableStartLine - 1].trim();
    const capMatch = prevLine.match(/^(?:Table|جدول):\s*(.*)/);
    if (capMatch) caption = capMatch[1].trim();
  }

  const start = lineStarts[tableStartLine];
  const endIdx = tableEndLine;
  const end = lineStarts[endIdx] + lines[endIdx].length;

  return {
    start, end,
    table: { header, body, align, caption, hasRowHeaders: false, autoNumber: false, colWidths: [] },
  };
}

function hasMerge(table: ParsedTable): boolean {
  if (table.header.some(c => (c.colspan ?? 1) > 1 || (c.rowspan ?? 1) > 1)) return true;
  for (const row of table.body) {
    if (row.some(c => (c.colspan ?? 1) > 1 || (c.rowspan ?? 1) > 1)) return true;
  }
  return false;
}

function hasWidths(table: ParsedTable): boolean {
  return table.colWidths.some(w => w !== undefined);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderCellHtml(cell: CellData, tag: 'th' | 'td', align: string): string {
  let attrs = '';
  if ((cell.colspan ?? 1) > 1) attrs += ` colspan="${cell.colspan}"`;
  if ((cell.rowspan ?? 1) > 1) attrs += ` rowspan="${cell.rowspan}"`;
  if (align) attrs += ` style="text-align:${align}"`;
  return `    <${tag}${attrs}>${escapeHtml(cell.text)}</${tag}>`;
}

function tableToHtml(table: ParsedTable): string {
  const alignMap = { left: 'left', center: 'center', right: 'right' };
  const dir = table.header.some(c => /[\u0600-\u06FF]/.test(c.text)) || table.body.some(r => r.some(c => /[\u0600-\u06FF]/.test(c.text))) ? 'rtl' : 'ltr';

  let out = `<table dir="${dir}">\n`;

  if (table.colWidths.some(w => w !== undefined)) {
    out += '  <colgroup>\n';
    for (const w of table.colWidths) {
      out += w !== undefined ? `    <col style="width:${w}%">\n` : '    <col>\n';
    }
    out += '  </colgroup>\n';
  }

  out += '  <thead>\n    <tr>\n';
  const startIdx = table.autoNumber ? 1 : 0;
  for (let ci = startIdx; ci < table.header.length; ci++) {
    const cell = table.header[ci];
    const a = table.align[ci] ? alignMap[table.align[ci]] : '';
    out += renderCellHtml(cell, 'th', a);
    out += '\n';
  }
  out += '    </tr>\n  </thead>\n  <tbody>\n';

  for (let ri = 0; ri < table.body.length; ri++) {
    out += '    <tr>\n';
    if (table.autoNumber) {
      out += `      <td style="text-align:center">${ri + 1}</td>\n`;
    }
    const startCol = table.hasRowHeaders ? 1 : 0;
    const endCol = table.body[ri].length;
    for (let ci = startCol; ci < endCol; ci++) {
      const cell = table.body[ri][ci];
      const isRowHeader = table.hasRowHeaders && ci === 0;
      const tag = isRowHeader ? 'th' : 'td';
      const a = table.align[ci] ? alignMap[table.align[ci]] : '';
      out += renderCellHtml(cell, tag, a);
      out += '\n';
    }
    out += '    </tr>\n';
  }
  out += '  </tbody>\n</table>';
  return out;
}

export function tableToMarkdown(table: ParsedTable): string {
  const cols = Math.max(table.header.length || 0, ...table.body.map(r => r.length));

  if (hasMerge(table) || hasWidths(table)) {
    let out = '';
    if (table.caption) out += `جدول: ${table.caption}\n`;
    out += tableToHtml(table) + '\n';
    return out;
  }

  const textCells = (cells: CellData[]) =>
    cells.map(c => c.text).concat(Array(Math.max(0, cols - cells.length)).fill(''));

  const hdr = textCells(table.header);
  const sepStr = table.align.length === hdr.length
    ? hdr.map((_, i) => table.align[i] === 'left' ? ':---' : table.align[i] === 'center' ? ':---:' : '---:').join(' | ')
    : hdr.map(() => '---').join(' | ');

  let out = '';
  if (table.caption) out += `جدول: ${table.caption}\n`;
  out += '| ' + hdr.join(' | ') + ' |\n';
  out += '| ' + sepStr + ' |\n';

  for (let ri = 0; ri < table.body.length; ri++) {
    const cells = textCells(table.body[ri]);
    if (table.autoNumber) cells[0] = String(ri + 1);
    out += '| ' + cells.join(' | ') + ' |\n';
  }
  return out;
}

export function parseCsv(text: string): ParsedTable {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return { header: [], body: [], align: [], caption: '', hasRowHeaders: false, autoNumber: false, colWidths: [] };

  const isTsv = text.includes('\t');

  function splitLine(line: string): string[] {
    if (isTsv) return line.split('\t');
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  }

  const rows = lines.map(splitLine);
  const cols = Math.max(...rows.map(r => r.length));
  const pad = (r: string[]) => r.concat(Array(Math.max(0, cols - r.length)).fill(''));

  const header = pad(rows[0]).map(t => ({ text: t }));
  const body = rows.slice(1).map(r => pad(r).map(t => ({ text: t })));
  const align = Array(cols).fill('left') as ('left' | 'center' | 'right')[];

  return { header, body, align, caption: '', hasRowHeaders: false, autoNumber: false, colWidths: [] };
}

export function cloneTable(t: ParsedTable): ParsedTable {
  return {
    header: t.header.map(c => ({ ...c })),
    body: t.body.map(r => r.map(c => ({ ...c }))),
    align: [...t.align],
    caption: t.caption,
    hasRowHeaders: t.hasRowHeaders,
    autoNumber: t.autoNumber,
    colWidths: [...t.colWidths],
  };
}
