import type MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';

/**
 * markdown-it plugin for classical Arabic book layouts:
 *   :::matn    — core text (centered, framed)
 *   :::sharh   — commentary (indented, secondary)
 *   :::hashiyah — marginal gloss (small, multi-column)
 *   :::page    — page-as-canvas wrapper (paged layout)
 *
 * Interlinear gloss is handled as a pre-processor step in markdown.ts
 * using the `{%gloss%}` inline syntax.
 */

export function classicalBookPlugin(md: MarkdownIt): void {
  // ── matn ──
  md.use(container, 'matn', {
    validate: () => true,
    render(tokens: any, idx: number): string {
      const token = tokens[idx];
      const info = token.info.trim();
      const extraClass = info.slice(4).trim(); // e.g. "matn .chapter" → ".chapter"
      if (token.nesting === 1) {
        return `<div class="matn${extraClass ? ' ' + extraClass : ''}">\n`;
      }
      return '</div>\n';
    },
  });

  // ── sharh ──
  md.use(container, 'sharh', {
    validate: () => true,
    render(tokens: any, idx: number): string {
      if (tokens[idx].nesting === 1) {
        return '<div class="sharh">\n';
      }
      return '</div>\n';
    },
  });

  // ── hashiyah ──
  md.use(container, 'hashiyah', {
    validate: () => true,
    render(tokens: any, idx: number): string {
      if (tokens[idx].nesting === 1) {
        return '<div class="hashiyah">\n';
      }
      return '</div>\n';
    },
  });

  // ── page ──
  md.use(container, 'page', {
    validate: () => true,
    render(tokens: any, idx: number): string {
      if (tokens[idx].nesting === 1) {
        return '<div class="classical-page">\n';
      }
      return '</div>\n';
    },
  });
}

/**
 * Pre-processor: convert `{%gloss%}` into interlinear HTML spans.
 * Called BEFORE md.render() so the HTML is treated as passthrough.
 *
 * Syntax:  BASE{%GLOSS%}  →  <span class="interlinear-unit">
 *                               <span class="interlinear-base">BASE</span>
 *                               <span class="interlinear-gloss">GLOSS</span>
 *                             </span>
 *
 * The regex matches a non-space word immediately followed by {%...%}.
 */
export function renderInterlinearGloss(text: string): string {
  return text.replace(
    /(\S+)\{%([^%]+)%\}/g,
    (_, base: string, gloss: string) =>
      `<span class="interlinear-unit"><span class="interlinear-base">${escapeHtml(base)}</span><span class="interlinear-gloss">${escapeHtml(gloss)}</span></span>`,
  );
}

/**
 * Pre-processor: wrap hashiyah entry markers `(N)` in anchor spans.
 * Applied within hashiyah divs after md.render().
 *
 * In hashiyah content:  "(1) text"  →  "<span class="hashiyah-ref">(1)</span> text"
 * In matn/sharh content: "text(1)"  →  "text<span class="hashiyah-anchor">(1)</span>"
 */
export function renderHashiyahRefs(html: string): string {
  // Within .hashiyah divs: mark leading (N) markers
  html = html.replace(
    /(<div class="hashiyah">[\s\S]*?<\/div>)/g,
    (block) =>
      block.replace(
        /\((\d+)\)/g,
        '<span class="hashiyah-ref">($1)</span>',
      ),
  );
  // Outside .hashiyah divs: mark (N) as hashiyah anchors
  const hashRefRe = /\((\d+)\)/g;
  const parts = html.split(/(<div class="hashiyah">[\s\S]*?<\/div>)/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // skip hashiyah blocks
      return part.replace(hashRefRe, '<span class="hashiyah-anchor">($1)</span>');
    })
    .join('');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
