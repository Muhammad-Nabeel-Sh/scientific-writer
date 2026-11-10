/**
 * Math for markdown-it, rendered with the app's single KaTeX instance.
 *
 *   inline:  $x^2$            (Pandoc rules: no space after the opening `$`,
 *                              none before the closing `$`, closing `$` not
 *                              followed by a digit)
 *   display: $$ … $$          (may span lines; inside lists/blockquotes too)
 *            $$ … $$ {#eq:id} (label after the closing `$$`)
 *
 * Numbering and labels are assigned by the numbering pass (structure.ts), so
 * a render, an export and a "list equations" query all agree.
 */
import katex from 'katex';
import type MarkdownIt from 'markdown-it';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import { escapeHtml, hasArabic, type RenderEnv } from './env';

const LABEL_RE = /^\s*\{#eq:([^\s{}]+)\}\s*$/;
const NO_METRICS_RE = /^No character metrics for /;

/**
 * Render TeX with KaTeX. Problems are reported through `warn` instead of the
 * console. Arabic letters in math are intended in this app, so KaTeX's
 * per-character complaints about them are dropped.
 */
export function renderTex(tex: string, display: boolean, warn?: (message: string) => void): string {
  const strict = (code: string, message: string) => {
    if (code === 'unknownSymbol' || code === 'unicodeTextInMathMode') {
      const ch = /"(.)"/u.exec(message)?.[1] ?? '';
      if (hasArabic(ch) || /[٠-٩]/.test(ch)) return 'ignore' as const;
    }
    warn?.(`${code}: ${message}`);
    return 'ignore' as const;
  };
  const base = { displayMode: display, output: 'htmlAndMathml' as const, strict };

  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && NO_METRICS_RE.test(args[0])) return;
    originalWarn.apply(console, args as []);
  };
  try {
    try {
      return katex.renderToString(tex, { ...base, throwOnError: true });
    } catch (e) {
      warn?.(e instanceof Error ? e.message : String(e));
      return katex.renderToString(tex, { ...base, throwOnError: false });
    }
  } finally {
    console.warn = originalWarn;
  }
}

/* ── inline $…$ ── */

function delimInfo(state: StateInline, pos: number) {
  const prev = pos > 0 ? state.src.charCodeAt(pos - 1) : -1;
  const next = pos + 1 <= state.posMax ? state.src.charCodeAt(pos + 1) : -1;
  return {
    canOpen: next !== 0x20 && next !== 0x09,
    canClose: !(prev === 0x20 || prev === 0x09 || (next >= 0x30 && next <= 0x39)),
  };
}

function mathInline(state: StateInline, silent: boolean): boolean {
  if (state.src[state.pos] !== '$') return false;

  if (!delimInfo(state, state.pos).canOpen) {
    if (!silent) state.pending += '$';
    state.pos += 1;
    return true;
  }

  const start = state.pos + 1;
  let match = start;
  while ((match = state.src.indexOf('$', match)) !== -1) {
    let p = match - 1;
    while (state.src[p] === '\\') p -= 1;
    if ((match - p) % 2 === 1) break; // even number of backslashes: real delimiter
    match += 1;
  }

  if (match === -1) {
    if (!silent) state.pending += '$';
    state.pos = start;
    return true;
  }
  if (match === start) {
    // `$$` inside a paragraph is not math
    if (!silent) state.pending += '$$';
    state.pos = start + 1;
    return true;
  }
  if (!delimInfo(state, match).canClose) {
    if (!silent) state.pending += '$';
    state.pos = start;
    return true;
  }

  if (!silent) {
    const token = state.push('math_inline', 'math', 0);
    token.markup = '$';
    token.content = state.src.slice(start, match);
  }
  state.pos = match + 1;
  return true;
}

/* ── display $$…$$ ── */

/** Split a closing line `… $$ {#eq:x}` into [content before $$, label]. Null if not a closer. */
function splitCloser(line: string): { before: string; label?: string } | null {
  const idx = line.lastIndexOf('$$');
  if (idx === -1) return null;
  const after = line.slice(idx + 2);
  if (after.trim() === '') return { before: line.slice(0, idx) };
  const m = LABEL_RE.exec(after);
  return m ? { before: line.slice(0, idx), label: m[1] } : null;
}

function mathBlock(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false; // indented code
  if (pos + 2 > max || state.src.slice(pos, pos + 2) !== '$$') return false;
  if (silent) return true;

  pos += 2;
  let first = state.src.slice(pos, max);
  let label: string | undefined;
  let found = false;
  let last = '';
  let next = startLine;

  const single = splitCloser(first);
  if (single && first.trim() !== '' && single.before.trim() !== '') {
    first = single.before;
    label = single.label;
    found = true;
  } else if (single && first.trim() !== '' && single.before.trim() === '' && single.label === undefined) {
    // "$$ $$" — empty display math; treat as closed
    first = '';
    found = true;
  }

  while (!found) {
    next++;
    if (next >= endLine) break;
    const p = state.bMarks[next] + state.tShift[next];
    const m = state.eMarks[next];
    if (p < m && state.tShift[next] < state.blkIndent) break; // dedent ends a list item
    const closer = splitCloser(state.src.slice(p, m));
    if (closer) {
      last = closer.before;
      label = closer.label;
      found = true;
    }
  }

  state.line = next + 1;
  const token = state.push('math_block', 'math', 0);
  token.block = true;
  token.content =
    (first.trim() ? first + '\n' : '') +
    state.getLines(startLine + 1, next, state.tShift[startLine], true) +
    (last.trim() ? last : '');
  token.map = [startLine, state.line];
  token.markup = '$$';
  token.meta = { label };
  return true;
}

/* ── renderers ── */

function warnFor(env: RenderEnv, line?: number) {
  return (message: string) => env.warnings?.push({ kind: 'math', message, line });
}

export function mathPlugin(md: MarkdownIt): void {
  md.inline.ruler.after('escape', 'math_inline', mathInline);
  md.block.ruler.after('blockquote', 'math_block', mathBlock, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });

  md.renderer.rules.math_inline = (tokens: Token[], idx: number, _o, env: RenderEnv) =>
    renderTex(tokens[idx].content, false, warnFor(env));

  md.renderer.rules.math_block = (tokens: Token[], idx: number, _o, env: RenderEnv) => {
    const t = tokens[idx];
    const html = `<p class="katex-block">${renderTex(t.content, true, warnFor(env, t.map?.[0]))}</p>`;
    const eq = t.meta?.equation as { id: string; number: number } | undefined;
    if (!eq) return html + '\n';
    return `<figure class="equation-figure" id="${escapeHtml(eq.id)}">${html}<figcaption class="eq-number">(${eq.number})</figcaption></figure>\n`;
  };
}
