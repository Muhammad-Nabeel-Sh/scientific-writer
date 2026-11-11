// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderDocument, renderMarkdown } from '$lib/markdown';
import { sanitizeHtml } from '$lib/sanitize';

describe('M1 delimiters', () => {
  it('\\( … \\) is inline math', () => {
    const html = renderMarkdown('القيمة \\(x^2\\) هنا');
    expect(html).toContain('<annotation encoding="application/x-tex">x^2</annotation>');
    expect(html).not.toContain('\\(');
  });

  it('\\[ … \\] is numbered display math, with a label', () => {
    const r = renderDocument('\\[\na+b\n\\] {#eq:sum}\n\n\\[ c \\]\n\n[ref:eq:sum]');
    expect(r.equations.map((e) => [e.id, e.number, e.latex])).toEqual([
      ['eq:sum', 1, 'a+b'],
      ['eq-2', 2, 'c'],
    ]);
    expect(r.html).toContain('class="eq-ref">(1)</a>');
  });

  it('an escaped paren that never closes stays text', () => {
    expect(renderMarkdown('\\(not math')).toContain('(not math');
  });
});

describe('M10 issue markers', () => {
  it('marks an undefined macro with data-macro, also inside equations', () => {
    const r = renderDocument('$\\foo + 1$\n\n$$\n\\bar{x} + \\baz\n$$');
    const markers = r.html.match(/class="sw-math-issue[^"]*"[^>]*>/g) ?? [];
    expect(markers).toHaveLength(2);
    expect(r.html).toContain('data-macro="foo"');
    expect(r.html).toContain('data-macro="baz"');
    expect(r.warnings.filter((w) => w.code === 'undefined-macro').map((w) => w.macro)).toEqual(['foo', 'baz']);
  });

  it('no marker for clean math, including Arabic text inside math', () => {
    expect(renderMarkdown('$$\nس = \\text{السرعة} \\times 2\n$$')).not.toContain('sw-math-issue');
  });

  it('markers survive sanitisation (data-macro, role, tabindex)', () => {
    const clean = sanitizeHtml(renderMarkdown('$\\foo$'));
    expect(clean).toContain('data-macro="foo"');
    expect(clean).toContain('role="button"');
    expect(clean).toContain('tabindex="0"');
  });
});

describe('M7 RTL prototype', () => {
  it('$$[rtl] renders MathML with dir="rtl" and no HTML layer', () => {
    const html = renderMarkdown('$$[rtl]\nس + ص\n$$');
    expect(html).toContain('<math dir="rtl"');
    expect(html).toContain('sw-math-rtl');
    expect(html).not.toContain('katex-html');
  });

  it('mathDir option applies to the whole document; [ltr] overrides it', () => {
    const r = renderDocument('$س$\n\n$$[ltr]\nx\n$$', { mathDir: 'rtl' });
    expect(r.html.match(/<math dir="rtl"/g)).toHaveLength(1);
    expect(r.html).toContain('katex-html');
  });

  it('mirrors arrows, uses Arabic-Indic digits and spaces function names in RTL', () => {
    const html = renderMarkdown('$$[rtl]\nس \\to 0.5 \\Rightarrow \\operatorname{جا} س\n$$');
    expect(html).toContain('<mo>←</mo>');
    expect(html).toContain('<mo>⇐</mo>');
    expect(html).not.toContain('<mo>→</mo>');
    expect(html).toContain('<mn>٠٫٥</mn>');
    expect(html).toContain('<mo>⁡</mo><mspace width="0.1667em"></mspace>');
  });

  it('keeps Western digits in RTL math when the document digit style is western', () => {
    const html = renderDocument('$$[rtl]\nس = 12\n$$', { digitStyle: 'western' }).html;
    expect(html).toContain('<mn>12</mn>');
  });

  it('LTR math is untouched by the RTL post-processing', () => {
    const html = renderMarkdown('$$\nx \\to 0\n$$');
    expect(html).toContain('<mo>→</mo>');
    expect(html).toContain('<mn>0</mn>');
  });

  it('RTL MathML survives sanitisation', () => {
    expect(sanitizeHtml(renderMarkdown('$$[rtl]\nس\n$$'))).toContain('<math dir="rtl"');
  });
});
