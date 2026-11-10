import type MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';

/**
 * markdown-it plugin for classical Arabic book layouts:
 *   :::matn    — core text (centered, framed)
 *   :::sharh   — commentary (indented, secondary)
 *   :::hashiyah — marginal gloss (small, multi-column)
 *   :::page    — page-as-canvas wrapper (paged layout)
 *
 * Interlinear gloss (`word{%gloss%}`) is a core rule in md/structure.ts.
 */

const CLASSICAL: { name: string; cls: string }[] = [
  { name: 'matn', cls: 'matn' },
  { name: 'sharh', cls: 'sharh' },
  { name: 'hashiyah', cls: 'hashiyah' },
  { name: 'page', cls: 'classical-page' },
];

/** Extra CSS classes after the name: `:::matn .chapter intro` → ["chapter", "intro"]. */
function extraClasses(info: string): string[] {
  return info
    .trim()
    .split(/\s+/)
    .slice(1)
    .map((c) => c.replace(/^\./, ''))
    .filter((c) => /^[A-Za-z][\w-]*$/.test(c));
}

export function classicalBookPlugin(md: MarkdownIt): void {
  for (const { name, cls } of CLASSICAL) {
    md.use(container, name, {
      // Each container claims only its own name (they used to accept anything,
      // so `:::matn` swallowed `:::sharh`/`:::hashiyah`).
      validate: (params: string) => params.trim().split(/\s+/)[0] === name,
      render(tokens: any, idx: number): string {
        const token = tokens[idx];
        if (token.nesting !== 1) return '</div>\n';
        const classes = [cls, ...extraClasses(token.info)].join(' ');
        return `<div class="${classes}">\n`;
      },
    });
  }
}
