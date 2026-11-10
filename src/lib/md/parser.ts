/**
 * The one configured markdown-it instance used by the preview, the PDF
 * print view, the exporters (via the token → AST builder) and analysis
 * queries (equation list, outline numbering). Same parse everywhere.
 */
import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import hljs from 'highlight.js';
import { academicBlocksPlugin, blockRefText } from '../blocks';
import { footnotePlugin } from '../footnotes';
import { classicalBookPlugin } from '../markdown-classical';
import { createEnv, escapeHtml, type RenderEnv, type RenderOptions } from './env';
import { inlineRefsPlugin } from './inline-refs';
import { mathPlugin } from './math';
import { structurePlugin } from './structure';

export interface PoetryVerse {
  sadr: string;
  ajuz?: string;
}

/** `sadr || ajuz` per line; a line without `||` is a single hemistich. */
export function parsePoem(str: string): PoetryVerse[] {
  return str
    .trim()
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      const parts = l.split('||');
      return parts.length >= 2 ? { sadr: parts[0].trim(), ajuz: parts[1].trim() } : { sadr: l.trim() };
    });
}

function renderPoem(str: string): string {
  const verses = parsePoem(str);
  if (verses.length === 0) return '';
  const inner = verses
    .map((v) =>
      v.ajuz === undefined
        ? `<div class="poem-verse single"><span class="verse-sadr">${escapeHtml(v.sadr)}</span></div>`
        : `<div class="poem-verse"><span class="verse-sadr">${escapeHtml(v.sadr)}</span><div class="verse-gap"></div><span class="verse-ajuz">${escapeHtml(v.ajuz)}</span></div>`,
    )
    .join('\n');
  return `<div class="arabic-poem" dir="rtl">\n${inner}\n</div>`;
}

function createParser(): MarkdownIt {
  const md: MarkdownIt = new MarkdownIt({
    html: true, // raw HTML is allowed; every sink sanitises (src/lib/sanitize.ts)
    linkify: true,
    typographer: true,
    highlight(str: string, lang: string): string {
      if (lang === 'poetry') return renderPoem(str);
      if (lang && hljs.getLanguage(lang)) {
        try {
          const hl = hljs.highlight(str, { language: lang, ignoreIllegals: true });
          return `<pre dir="auto"><code class="hljs language-${escapeHtml(lang)}">${hl.value}</code></pre>`;
        } catch {
          /* fall through */
        }
      }
      return `<pre dir="auto"><code class="hljs">${escapeHtml(str)}</code></pre>`;
    },
  });

  md.use(mathPlugin)
    .use(inlineRefsPlugin)
    .use(structurePlugin, { blockRefText: () => blockRefText })
    .use(academicBlocksPlugin)
    .use(footnotePlugin)
    .use(classicalBookPlugin);
  return md;
}

let instance: MarkdownIt | null = null;

/** The shared parser. Stateless between calls: all per-document state is in `env`. */
export function getParser(): MarkdownIt {
  return (instance ??= createParser());
}

export interface ParseResult {
  tokens: Token[];
  env: RenderEnv;
}

/** Parse only (no HTML). Numbering, labels, citations and warnings are filled in `env`. */
export function parse(text: string, options: RenderOptions = {}): ParseResult {
  const env = createEnv(options);
  const tokens = getParser().parse(text, env);
  return { tokens, env };
}
