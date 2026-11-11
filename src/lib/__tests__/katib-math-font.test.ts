import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

describe('Katib Math font is shipped with its licence', () => {
  it('web font is a WOFF2 file and the licence sits next to it', () => {
    const woff2 = readFileSync(ROOT + 'static/fonts/katib-math/KatibMath-Regular.woff2');
    expect(woff2.subarray(0, 4).toString('latin1')).toBe('wOF2');
    const ofl = readFileSync(ROOT + 'static/fonts/katib-math/OFL.txt', 'utf8');
    expect(ofl).toContain('SIL OPEN FONT LICENSE');
    expect(ofl).toContain('Amiri Project Authors');
    expect(ofl).toContain('Khaled Hosny');
  });

  it('the OTF release for LaTeX/Word is committed in dist', () => {
    expect(existsSync(ROOT + 'fonts-src/katib-math/dist/KatibMath-Regular.otf')).toBe(true);
  });

  it('app.css loads it and routes Arabic in KaTeX and RTL math to it', () => {
    const css = readFileSync(ROOT + 'src/app.css', 'utf8');
    expect(css).toContain("font-family: 'Katib Math'");
    expect(css).toMatch(/font-family: 'KaTeX_Math'; src: url\('\/fonts\/katib-math\/KatibMath-Regular\.woff2'\)/);
    expect(css).toContain(".katex.sw-math-rtl math { font-family: 'Katib Math'");
  });

  it('no Mazeri or trial fonts are shipped', () => {
    const css = readFileSync(ROOT + 'src/app.css', 'utf8');
    expect(css).not.toMatch(/mazeri|bayannur/i);
  });
});
