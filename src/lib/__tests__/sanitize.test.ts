// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import katex from 'katex';
import { sanitizeHtml } from '$lib/sanitize';
import { renderMarkdown } from '$lib/markdown';

describe('sanitizeHtml — strips active content', () => {
  it('removes <script>', () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script>');
    expect(out).toContain('<p>ok</p>');
    expect(out).not.toContain('script');
  });

  it('removes event handlers (the Tauri IPC attack vector)', () => {
    const out = sanitizeHtml(
      `<img src="x" onerror="window.__TAURI_INTERNALS__.invoke('write_text_file',{})">`,
    );
    expect(out).toContain('<img');
    expect(out).not.toMatch(/onerror/i);
    expect(out).not.toContain('__TAURI');
  });

  it('removes javascript: URLs', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toMatch(/javascript:/i);
  });

  it('removes iframes, objects, forms, style and base tags', () => {
    const out = sanitizeHtml(
      '<iframe src="https://e.com"></iframe><object data="x"></object>' +
        '<form><input name="a"></form><style>body{display:none}</style><base href="https://e.com/">',
    );
    expect(out).not.toMatch(/<(iframe|object|form|input|style|base)\b/i);
  });

  it('removes SVG scripting and foreign handlers', () => {
    const out = sanitizeHtml('<svg><script>alert(1)</script><a href="javascript:x"><text>t</text></a></svg>');
    expect(out).not.toMatch(/script|javascript:/i);
  });

  it('drops fixed-position and url() inline styles but keeps ordinary ones', () => {
    const out = sanitizeHtml(
      '<div style="position:fixed;inset:0">a</div><span style="background:url(https://e.com/t)">b</span><span style="height:1em">c</span>',
    );
    expect(out).not.toMatch(/fixed|url\(/i);
    expect(out).toContain('style="height:1em"');
  });
});

describe('sanitizeHtml — keeps what the app renders', () => {
  it('keeps KaTeX HTML, MathML semantics/annotation and SVG', () => {
    const src = katex.renderToString('\\sqrt{\\frac{a}{b}}', { displayMode: true, throwOnError: false });
    const out = sanitizeHtml(src);
    expect(out).toContain('class="katex-display"');
    expect(out).toContain('<math');
    expect(out).toContain('<semantics>');
    expect(out).toContain('<annotation encoding="application/x-tex">');
    expect(out).toContain('<svg');
    expect(out).toContain('<path');
  });

  it('does not drop any element or attribute from KaTeX output', () => {
    const formulas = [
      '\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}',
      '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
      '\\overrightarrow{AB} + \\widehat{xyz} \\xrightarrow[a]{b}',
      '\\sum_{i=1}^{n} \\binom{n}{i} \\left( \\frac{1}{2} \\right)^i',
      '\\text{السرعة} = \\cancel{x} \\boxed{y}',
    ];
    const count = (h: string) => {
      const d = document.createElement('div');
      d.innerHTML = h;
      const els = d.querySelectorAll('*');
      let attrs = 0;
      els.forEach((e) => (attrs += e.attributes.length));
      return { els: els.length, attrs };
    };
    for (const f of formulas) {
      const src = katex.renderToString(f, { displayMode: true, throwOnError: false, strict: 'ignore' });
      expect(count(sanitizeHtml(src)), f).toEqual(count(src));
    }
  });

  it('keeps wiki-link data attributes, ids and dir', () => {
    const html =
      '<p dir="auto"><a href="#" class="wiki-link wiki-link-resolved" data-note-id="note-5">x</a></p>' +
      '<figure class="equation-figure" id="eq:lbl"><figcaption class="eq-number">(1)</figcaption></figure>';
    const out = sanitizeHtml(html);
    expect(out).toContain('data-note-id="note-5"');
    expect(out).toContain('id="eq:lbl"');
    expect(out).toContain('dir="auto"');
  });

  it('keeps asset-protocol and data image URLs', () => {
    const out = sanitizeHtml(
      '<img src="http://asset.localhost/D%3A%2Fws%2Fassets%2Fa.png" loading="lazy">' +
        '<img src="asset://localhost/%2Fws%2Fassets%2Fb.png">' +
        '<img src="data:image/png;base64,iVBORw0KGgo=">',
    );
    expect(out).toContain('http://asset.localhost/');
    expect(out).toContain('asset://localhost/');
    expect(out).toContain('data:image/png;base64');
    expect(out).toContain('loading="lazy"');
  });

  it('is stable on the full render pipeline output (math, poetry, tables)', () => {
    const md = [
      '# عنوان',
      '',
      'نص مع معادلة $x^2$ و[^1].',
      '',
      '$$',
      '\\sigma = \\frac{F}{A}',
      '$$',
      '',
      '```poetry',
      'صدر البيت || عجز البيت',
      '```',
      '',
      '| أ | ب |',
      '|---|---|',
      '| ١ | ٢ |',
      '',
      '[^1]: حاشية',
    ].join('\n');
    const raw = renderMarkdown(md);
    const out = sanitizeHtml(raw);
    for (const needle of ['katex', 'arabic-poem', 'verse-sadr', '<table', 'equation-figure', '<h1']) {
      expect(out).toContain(needle);
    }
  });
});
