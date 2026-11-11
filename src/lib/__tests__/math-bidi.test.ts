// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderMath, isolateArabicRuns } from '$lib/math';
import { renderMarkdown } from '$lib/markdown';
import { sanitizeHtml } from '$lib/sanitize';

function visible(html: string): string {
  return html.slice(html.indexOf('<span class="katex-html"'));
}

function mathml(html: string): string {
  return html.slice(0, html.indexOf('<span class="katex-html"'));
}

describe('M14: Arabic runs are isolated in LTR KaTeX output', () => {
  it('wraps the Arabic subscript letter so "س → 0" keeps TeX order', () => {
    const html = renderMath('\\operatorname*{\\text{نها}}_{س \\to 0}', { display: true });
    const v = visible(html);
    expect(v).toContain('<span class="sw-ar" dir="rtl">نها</span>');
    expect(v).toContain('<span class="sw-ar" dir="rtl">س</span>');
    // atoms stay in source order in the DOM: س, then →, then 0
    const s = v.indexOf('>س<'), arrow = v.indexOf('→'), zero = v.lastIndexOf('>0<');
    expect(s).toBeGreaterThan(-1);
    expect(s).toBeLessThan(arrow);
    expect(arrow).toBeLessThan(zero);
  });

  it('keeps a multi-word \\text{} as ONE run (joining and word order intact)', () => {
    const v = visible(renderMath('\\text{كتلة الجسم} = m', { display: false }));
    // KaTeX turns the space inside \text{} into a no-break space; the run spans it.
    expect(v).toContain('<span class="sw-ar" dir="rtl">كتلة الجسم</span>');
    expect(v.match(/class="sw-ar"/g)).toHaveLength(1);
  });

  it('does not touch the MathML layer or its TeX annotation', () => {
    const html = renderMath('\\text{السرعة} = 2', { display: false });
    expect(mathml(html)).not.toContain('sw-ar');
    expect(mathml(html)).toContain('<annotation encoding="application/x-tex">\\text{السرعة} = 2</annotation>');
  });

  it('leaves formulas without Arabic unchanged', () => {
    const html = renderMath('x^2 + \\frac{a}{b}', { display: true });
    expect(html).not.toContain('sw-ar');
    expect(isolateArabicRuns(html)).toBe(html);
  });

  it('does not wrap RTL (MathML-only) output', () => {
    expect(renderMath('س + 1', { display: true, dir: 'rtl' })).not.toContain('sw-ar');
  });

  it('wraps Arabic in registry function names and survives sanitisation', () => {
    const clean = sanitizeHtml(renderMarkdown('$$\n\\nihaya_{س \\to 0} \\frac{\\jaa س}{س}\n$$'));
    expect(clean).toContain('<span class="sw-ar" dir="rtl">جا</span>');
    expect(clean).toContain('<span class="sw-ar" dir="rtl">نها</span>');
  });

  it('escaped characters next to Arabic are not broken', () => {
    const v = visible(renderMath('\\text{أ<ب}', { display: false }));
    expect(v).toContain('&lt;');
    expect(v).not.toMatch(/sw-ar[^>]*>[^<]*&lt/);
  });
});
