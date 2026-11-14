// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderMath, getSymbols } from '$lib/math';
import { sanitizeHtml } from '$lib/sanitize';

/** Text content of the sanitised MathML (what an RTL equation shows). */
function mathmlText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = sanitizeHtml(html);
  const math = div.querySelector('math');
  math?.querySelector('annotation')?.remove();
  return math?.textContent ?? '';
}

describe('symbols survive sanitising in right-to-left (MathML-only) math', () => {
  it.each(['\\rint', '\\riint', '\\riiint', '\\roint', '\\roiint', '\\rpropto', '\\arComplex'])('%s', (tex) => {
    const html = renderMath(tex, { display: true, dir: 'rtl' });
    expect(mathmlText(html).trim()).not.toBe('');
    expect(html).not.toMatch(/<(mi|mo|mn)[^>]*><(mi|mo|mn|mtext)/);
  });

  it('no built-in symbol renders empty', () => {
    const empty = getSymbols()
      .filter((s) => s.arity === 0)
      .map((s) => `\\${s.name}`)
      .filter((tex) => mathmlText(renderMath(tex, { display: true, dir: 'rtl' })).trim() === '');
    expect(empty).toEqual([]);
  });

  it('keeps the bold variant of \\arComplex', () => {
    expect(renderMath('\\arComplex', { display: true, dir: 'rtl' })).toMatch(/<mi[^>]*mathvariant="bold"[^>]*>ك<\/mi>/);
  });
});
