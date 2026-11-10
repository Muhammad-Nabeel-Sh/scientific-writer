import { describe, it, expect, vi } from 'vitest';
import { renderDocument, analyzeMarkdown, renderMarkdown } from '$lib/markdown';
import { renderTex } from '$lib/md/math';
import { parseBibTeX } from '$lib/bibliography';

const bib = parseBibTeX(`@book{smith2020, author={Smith, John}, title={T}, year={2020}}`);

describe('equations', () => {
  it('numbers display equations, honours labels and resolves refs (incl. forward refs)', () => {
    const src = [
      'see [ref:eq:energy] and [ref:eq:1]',
      '',
      '$$',
      'a = b',
      '$$',
      '',
      '$$',
      'E = mc^2',
      '$$ {#eq:energy}',
    ].join('\n');
    const r = renderDocument(src);
    expect(r.equations.map((e) => [e.id, e.number, e.label])).toEqual([
      ['eq-1', 1, undefined],
      ['eq:energy', 2, 'energy'],
    ]);
    expect(r.html).toContain('<a href="#eq:energy" class="eq-ref">(2)</a>');
    expect(r.html).toContain('<a href="#eq-1" class="eq-ref">(1)</a>');
    expect(r.html).toContain('<figure class="equation-figure" id="eq:energy">');
    expect(r.html).toContain('<figcaption class="eq-number">(2)</figcaption>');
    expect(r.html).not.toContain('{#eq:');
  });

  it('accepts single-line display math with a label', () => {
    const r = renderDocument('$$ x^2 $$ {#eq:sq}\n\n[ref:eq:sq]');
    expect(r.equations).toEqual([expect.objectContaining({ id: 'eq:sq', number: 1, latex: 'x^2' })]);
    expect(r.html).toContain('class="eq-ref">(1)</a>');
  });

  it('does not number `$$` inside code, and does not count it', () => {
    const r = renderDocument('`$$x$$`\n\n```\n$$\ny\n$$\n```\n\n$$\nz\n$$');
    expect(r.equations).toHaveLength(1);
    expect(r.equations[0].number).toBe(1);
  });

  it('renders math inside list items and blockquotes', () => {
    const r = renderDocument('- item\n\n  $$\n  a+b\n  $$\n\n> $$\n> c\n> $$');
    expect(r.equations).toHaveLength(2);
    expect(r.html.match(/equation-figure/g)).toHaveLength(2);
  });

  it('reports unknown macros as warnings, not console noise', () => {
    const warn = vi.spyOn(console, 'warn');
    const r = renderDocument('$$\n\\notamacro{x} + \\text{السرعة}\n$$');
    expect(r.warnings.some((w) => w.kind === 'math' && /notamacro/.test(w.message))).toBe(true);
    // Arabic letters in math are intended: no per-character complaints
    expect(r.warnings.some((w) => /unknownSymbol|unicodeTextInMathMode/.test(w.message))).toBe(false);
    expect(renderDocument('$$\nس + ص = \\text{السرعة}\n$$').warnings).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('exposes per-equation diagnostics for the equation dialog', () => {
    const warnings: string[] = [];
    renderTex('\\notamacro{x}', true, (m) => warnings.push(m));
    expect(warnings.some((m) => /notamacro/.test(m))).toBe(true);
  });

  it('keeps western digits in math and converts prose digits (eastern)', () => {
    const html = renderMarkdown('القيمة 3 هي $x_1 = 2$', [], 'eastern');
    expect(html).toContain('القيمة ٣');
    expect(html).toContain('<annotation encoding="application/x-tex">x_1 = 2</annotation>');
  });
});

describe('digits', () => {
  it('leaves code, link URLs, citations and refs untouched', () => {
    const html = renderMarkdown(
      'نص 12 `code 34` [رابط](https://e.com/56) [@smith2020] [ref:eq:7]',
      bib,
      'auto',
    );
    expect(html).toContain('نص ١٢');
    expect(html).toContain('<code>code 34</code>');
    expect(html).toContain('https://e.com/56');
    expect(html).toContain('(Smith, 2020)');
    expect(html).toContain('[ref:eq:7]');
  });

  it('does not touch raw HTML attributes', () => {
    const html = renderMarkdown('<div style="width:100px">عربي 5</div>', [], 'eastern');
    expect(html).toContain('width:100px');
  });

  it('auto style converts only lines with Arabic', () => {
    const html = renderMarkdown('English 12\n\nعربي 12', [], 'auto');
    expect(html).toContain('English 12');
    expect(html).toContain('عربي ١٢');
  });
});

describe('figures and tables', () => {
  it('numbers figures and tables and captions tables', () => {
    const src = '![شكل أ](a.png)\n\n![B](b.png)\n\nجدول: نتائج التجربة\n| أ | ب |\n|---|---|\n| 1 | 2 |';
    const r = renderDocument(src);
    expect(r.figures.map((f) => [f.id, f.number])).toEqual([['fig-a', 1], ['fig-b', 2]]);
    expect(r.html).toContain('الشكل 1: شكل أ');
    expect(r.html).toContain('Figure 2: B');
    expect(r.tables).toEqual([{ id: 'tbl-1', number: 1, caption: 'نتائج التجربة' }]);
    expect(r.html).toContain('جدول 1: نتائج التجربة');
    expect(r.html).not.toContain('<p dir="auto">جدول:');
  });

  it('labelLang forces label language', () => {
    expect(renderDocument('![B](b.png)', { labelLang: 'ar' }).html).toContain('الشكل 1');
  });
});

describe('citations', () => {
  it('formats citations, tracks used/missing keys and appends bibliography', () => {
    const r = renderDocument('[@smith2020; @nobody] و [@smith2020]', { bibEntries: bib });
    expect(r.citations).toEqual({ used: ['smith2020'], missing: ['nobody'] });
    expect(r.html).toContain('(Smith, 2020; ?nobody?)');
    expect(r.html).toContain('class="bibliography"');
    expect(r.warnings.some((w) => w.kind === 'citation')).toBe(true);
  });
});

describe('wiki links', () => {
  it('stay literal without a resolver and are resolved with one', () => {
    expect(renderMarkdown('[[ملاحظة]]')).toContain('[[ملاحظة]]');
    const html = renderDocument('[[ملاحظة|اضغط]] [[مفقود]]', {
      resolveWikiLink: (n) => (n === 'ملاحظة' ? 'id-1' : null),
    }).html;
    expect(html).toContain('<a href="#" class="wiki-link wiki-link-resolved" data-note-id="id-1">اضغط</a>');
    expect(html).toContain('<span class="wiki-link wiki-link-missing">مفقود</span>');
  });

  it('are not converted inside code', () => {
    const html = renderDocument('`[[x]]`', { resolveWikiLink: () => 'id' }).html;
    expect(html).toContain('<code>[[x]]</code>');
  });
});

describe('academic blocks', () => {
  it('numbers blocks per type and resolves block refs', () => {
    const src = ':::theorem {#pyth} فيثاغورس\nنص\n:::\n\n:::نظرية\nأخرى\n:::\n\n[ref:theorem:pyth] [ref:theorem:theorem-2] [ref:lemma:x]';
    const r = renderDocument(src);
    expect(r.blocks.map((b) => [b.id, b.type, b.number])).toEqual([
      ['pyth', 'theorem', 1],
      ['theorem-2', 'theorem', 2],
    ]);
    expect(r.html).toContain('<a href="#pyth" class="block-ref">Theorem 1</a>');
    expect(r.html).toContain('<a href="#theorem-2" class="block-ref">Theorem 2</a>');
    expect(r.html).toContain('class="block-ref-unresolved">[ref:lemma:x]');
    expect(r.warnings.some((w) => w.kind === 'ref')).toBe(true);
  });

  it('does not swallow classical containers', () => {
    const html = renderMarkdown(':::sharh\nشرح\n:::\n\n:::hashiyah\nحاشية\n:::');
    expect(html).toContain('<div class="sharh">');
    expect(html).toContain('<div class="hashiyah">');
    expect(html).not.toContain('academic-block');
  });
});

describe('paragraphs and lists', () => {
  it('each source line is its own paragraph (with its own direction)', () => {
    const html = renderMarkdown('سطر عربي\nEnglish line');
    expect(html).toBe('<p dir="auto">سطر عربي</p>\n<p dir="auto">English line</p>\n');
  });

  it('keeps lists tight and blockquote continuation together', () => {
    const html = renderMarkdown('- a\n- b\n\n> one\ntwo');
    expect(html).toContain('<li dir="auto">a</li>');
    expect(html.match(/<blockquote/g)).toHaveLength(1);
  });

  it('turns line breaks inside tight list items into <br>', () => {
    expect(renderMarkdown('- a\n  b')).toContain('a<br>');
  });
});

describe('render state isolation', () => {
  it('renders are independent (no shared counters)', () => {
    const a = renderDocument('$$\na\n$$\n\n![x](x.png)');
    const b = renderDocument('$$\nb\n$$\n\n![x](x.png)');
    expect(b.equations[0].number).toBe(1);
    expect(b.figures[0].id).toBe('fig-x');
    expect(a.equations[0].latex).toBe('a');
  });

  it('analyzeMarkdown matches renderDocument numbering without rendering', () => {
    const src = '$$\na\n$$ {#eq:a}\n\n| x |\n|---|\n| 1 |';
    const an = analyzeMarkdown(src);
    const r = renderDocument(src);
    expect(an.equations).toEqual(r.equations);
    expect(an.tables).toEqual(r.tables);
  });
});
