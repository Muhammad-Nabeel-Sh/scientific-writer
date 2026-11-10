import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseDocument } from '$lib/publishing/document';
import { renderDocument } from '$lib/markdown';
import { parseBibTeX } from '$lib/bibliography';
import { LatexExporter } from '$lib/publishing/latex-exporter';
import { TypstExporter } from '$lib/publishing/typst-exporter';
import { MarkdownExporter } from '$lib/publishing/markdown-exporter';
import type { BlockNode } from '$lib/publishing/ast';

const FIXTURES = fileURLToPath(new URL('../../../tests/fixtures/', import.meta.url));

function types(blocks: BlockNode[]): string[] {
  return blocks.map((b) => b.type);
}

describe('parseDocument (token → AST)', () => {
  it('builds the basic block types and takes the title from the first H1', () => {
    const doc = parseDocument('# العنوان\n\nفقرة **قوية** و*مائلة* و`رمز`\n\n---\n\n> اقتباس');
    expect(doc.meta.title).toBe('العنوان');
    expect(types(doc.blocks)).toEqual(['heading', 'paragraph', 'thematicBreak', 'blockquote']);
    const p = doc.blocks[1];
    expect(p.type === 'paragraph' && p.children.map((c) => c.type)).toEqual([
      'text', 'strong', 'text', 'emphasis', 'text', 'inlineCode',
    ]);
  });

  it('keeps poetry fences as poetry (the old parser turned them into code)', () => {
    const doc = parseDocument('```poetry\nصدر || عجز\nبيت مفرد\n```');
    expect(doc.blocks).toEqual([
      { type: 'poetry', verses: [{ sadr: 'صدر', ajuz: 'عجز' }, { sadr: 'بيت مفرد' }] },
    ]);
  });

  it('numbers math, figures and tables exactly like the preview', () => {
    const src = '![ش](a.png)\n\n$$\nx\n$$ {#eq:x}\n\nجدول: نتائج\n| أ |\n|---|\n| 1 |\n\n[ref:eq:x]';
    const doc = parseDocument(src);
    const r = renderDocument(src);
    const [fig, math, table, para] = doc.blocks;
    expect(fig).toMatchObject({ type: 'imageFigure', id: r.figures[0].id, number: 1, caption: 'ش' });
    expect(math).toMatchObject({ type: 'mathBlock', value: 'x', label: 'x', id: 'eq:x', number: 1 });
    expect(table).toMatchObject({ type: 'table', caption: 'نتائج', id: 'tbl-1', number: 1 });
    expect(para.type === 'paragraph' && para.children[0]).toEqual({ type: 'equationRef', ref: 'x', display: '(1)' });
  });

  it('maps footnotes, citations, wiki links, inline math and line breaks', () => {
    const bib = parseBibTeX('@book{k1, author={A, B}, title={T}, year={2001}}');
    const doc = parseDocument('نص[^1] [@k1; @ms:k2] [[ملاحظة|هنا]] $a^2$\n\n[^1]: حاشية', bib);
    const p = doc.blocks[0];
    if (p.type !== 'paragraph') throw new Error('expected paragraph');
    expect(p.children).toEqual([
      { type: 'text', value: 'نص' },
      { type: 'footnoteRef', id: '1' },
      { type: 'text', value: ' ' },
      { type: 'citation', key: 'k1' },
      { type: 'citation', key: 'k2' },
      { type: 'text', value: ' ' },
      { type: 'wikiLink', target: 'ملاحظة', display: 'هنا' },
      { type: 'text', value: ' ' },
      { type: 'inlineMath', value: 'a^2' },
    ]);
    expect(doc.blocks[1]).toMatchObject({ type: 'footnoteDefinition', id: '1' });
    expect(doc.errors.some((e) => e.includes('k2'))).toBe(true);
  });

  it('builds lists with tightness, start and task items', () => {
    const doc = parseDocument('3. أ\n4. ب\n\n- [x] تم\n- [ ] لم يتم');
    const [ol, ul] = doc.blocks;
    expect(ol).toMatchObject({ type: 'list', ordered: true, start: 3, tight: true });
    if (ul.type !== 'list') throw new Error('expected list');
    expect(ul.items.map((i) => i.checked)).toEqual([true, false]);
    expect(ul.items[0].children[0]).toEqual({ type: 'paragraph', children: [{ type: 'text', value: 'تم' }] });
  });

  it('maps academic and classical containers; :::page contributes its children', () => {
    const doc = parseDocument(':::theorem {#t1} عنوان\nنص\n:::\n\n::::page\n:::matn\nمتن\n:::\n:::sharh\nشرح\n:::\n::::');
    expect(doc.blocks[0]).toMatchObject({ type: 'academicBlock', blockType: 'theorem', label: 't1', id: 't1', number: 1 });
    expect(types(doc.blocks.slice(1))).toEqual(['matn', 'sharh']);
  });

  it('keeps the author’s digits (no Arabic-Indic conversion in the export model)', () => {
    const doc = parseDocument('القيمة 42');
    expect(doc.blocks[0]).toEqual({ type: 'paragraph', children: [{ type: 'text', value: 'القيمة 42' }] });
  });

  it('reads table cell alignment', () => {
    const doc = parseDocument('| a | b |\n|:--|--:|\n| 1 | 2 |');
    const t = doc.blocks[0];
    if (t.type !== 'table') throw new Error('expected table');
    expect(t.header[0].cells.map((c) => c.align)).toEqual(['left', 'right']);
    expect(t.body).toHaveLength(1);
  });
});

describe('exporters run on every fixture', () => {
  const files = [
    'classical-book-intro.md', 'classical-matn-salah.md', 'classical-sharh-taharah.md',
    'classical-hawashi.md', 'interlinear-gloss.md', 'code-and-table.md',
  ];
  const bib = parseBibTeX(readFileSync(FIXTURES + 'references.bib', 'utf8'));
  for (const file of files) {
    it(file, async () => {
      const doc = parseDocument(readFileSync(FIXTURES + file, 'utf8'), bib);
      expect(doc.blocks.length).toBeGreaterThan(0);
      for (const ex of [new LatexExporter(), new TypstExporter(), new MarkdownExporter()]) {
        const out = await ex.export(doc);
        expect(typeof out.content === 'string' && out.content.length).toBeGreaterThan(0);
      }
    });
  }
});
