/**
 * Math for markdown-it, rendered with the app's single KaTeX instance.
 *
 *   inline:  $x^2$            (Pandoc rules: no space after the opening `$`,
 *                              none before the closing `$`, closing `$` not
 *                              followed by a digit)
 *            \( … \)
 *   display: $$ … $$          (may span lines; inside lists/blockquotes too)
 *            \[ … \]
 *            $$ … $$ {#eq:id} (label after the closer; also after `\]`)
 *            $$[rtl] …  $$    (experimental right-to-left MathML, M7)
 *
 * Formulas with problems get a ⚠ marker (class `sw-math-issue`); for an
 * undefined macro it carries `data-macro` so the preview can offer to define it.
 *
 * Numbering and labels are assigned by the numbering pass (structure.ts), so
 * a render, an export and a "list equations" query all agree.
 */
import type MarkdownIt from 'markdown-it';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import { renderMath, type MathIssue } from '../math';
import { escapeHtml, type RenderEnv } from './env';

const LABEL_RE = /^\s*\{#eq:([^\s{}]+)\}\s*$/;

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

/* ── inline \(…\) ── */

function parenInline(state: StateInline, silent: boolean): boolean {
  const { src, pos } = state;
  if (src.charCodeAt(pos) !== 0x5c || src.charCodeAt(pos + 1) !== 0x28 /* ( */) return false;
  const end = src.indexOf('\\)', pos + 2);
  if (end === -1 || end > state.posMax) return false;
  if (!silent) {
    const token = state.push('math_inline', 'math', 0);
    token.markup = '\\(';
    token.content = src.slice(pos + 2, end);
  }
  state.pos = end + 2;
  return true;
}

/* ── display $$…$$ and \[…\] ── */

const DIR_RE = /^\[(rtl|ltr)\]/;

/** Split a closing line `… $$ {#eq:x}` into [content before the closer, label]. Null if not a closer. */
function splitCloser(line: string, close: string): { before: string; label?: string } | null {
  const idx = line.lastIndexOf(close);
  if (idx === -1) return null;
  const after = line.slice(idx + close.length);
  if (after.trim() === '') return { before: line.slice(0, idx) };
  const m = LABEL_RE.exec(after);
  return m ? { before: line.slice(0, idx), label: m[1] } : null;
}

function displayRule(open: string, close: string) {
  return function mathBlock(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
    let pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    if (state.sCount[startLine] - state.blkIndent >= 4) return false; // indented code
    if (pos + open.length > max || state.src.slice(pos, pos + open.length) !== open) return false;
    if (silent) return true;

    pos += open.length;
    let first = state.src.slice(pos, max);
    let dir: 'rtl' | 'ltr' | undefined;
    const d = DIR_RE.exec(first);
    if (d) {
      dir = d[1] as 'rtl' | 'ltr';
      first = first.slice(d[0].length);
    }
    let label: string | undefined;
    let found = false;
    let last = '';
    let next = startLine;

    const single = splitCloser(first, close);
    if (single && first.trim() !== '' && single.before.trim() !== '') {
      first = single.before;
      label = single.label;
      found = true;
    } else if (single && first.trim() !== '' && single.before.trim() === '' && single.label === undefined) {
      first = ''; // "$$ $$" — empty display math
      found = true;
    }

    while (!found) {
      next++;
      if (next >= endLine) break;
      const p = state.bMarks[next] + state.tShift[next];
      const m = state.eMarks[next];
      if (p < m && state.tShift[next] < state.blkIndent) break; // dedent ends a list item
      const closer = splitCloser(state.src.slice(p, m), close);
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
    token.markup = open;
    token.meta = { label, dir };
    return true;
  };
}

/* ── renderers ── */

/**
 * Render one formula, record its problems in `env.warnings`, and append a
 * marker the preview can act on (M10). An undefined macro's marker carries
 * `data-macro`, which opens the custom-symbol editor prefilled.
 */
function renderWithDiagnostics(
  tex: string,
  display: boolean,
  dir: 'ltr' | 'rtl' | undefined,
  env: RenderEnv,
  line: number | undefined,
): { html: string; marker: string } {
  const issues: MathIssue[] = [];
  const digits = env.options?.digitStyle === 'western' ? 'western' : 'arabic-indic';
  const html = renderMath(tex, { display, dir, digits, onIssue: (i) => issues.push(i) });
  for (const issue of issues) {
    env.warnings?.push({ kind: 'math', message: issue.message, line, code: issue.code, macro: issue.macro });
  }
  return { html, marker: issueMarker(issues) };
}

function issueMarker(issues: MathIssue[]): string {
  if (issues.length === 0) return '';
  const undefinedMacro = issues.find((i) => i.code === 'undefined-macro' && i.macro);
  if (undefinedMacro) {
    const name = escapeHtml(undefinedMacro.macro!);
    const title = `الرمز \\${name} غير معرَّف — انقر لإضافته إلى الرموز المخصصة`;
    return `<span class="sw-math-issue sw-math-issue-macro" data-macro="${name}" role="button" tabindex="0" title="${title}">⚠</span>`;
  }
  const title = escapeHtml(issues.map((i) => i.message).join('\n'));
  return `<span class="sw-math-issue" title="${title}">⚠</span>`;
}

function mathDir(token: Token, env: RenderEnv): 'ltr' | 'rtl' | undefined {
  return (token.meta?.dir as 'ltr' | 'rtl' | undefined) ?? env.options?.mathDir;
}

export function mathPlugin(md: MarkdownIt): void {
  md.inline.ruler.before('escape', 'math_inline_paren', parenInline);
  md.inline.ruler.after('escape', 'math_inline', mathInline);
  const alt = ['paragraph', 'reference', 'blockquote', 'list'];
  md.block.ruler.after('blockquote', 'math_block', displayRule('$$', '$$'), { alt });
  md.block.ruler.after('math_block', 'math_block_bracket', displayRule('\\[', '\\]'), { alt });

  md.renderer.rules.math_inline = (tokens: Token[], idx: number, _o, env: RenderEnv) => {
    const t = tokens[idx];
    const { html, marker } = renderWithDiagnostics(t.content, false, mathDir(t, env), env, undefined);
    return html + marker;
  };

  md.renderer.rules.math_block = (tokens: Token[], idx: number, _o, env: RenderEnv) => {
    const t = tokens[idx];
    const { html: math, marker } = renderWithDiagnostics(t.content, true, mathDir(t, env), env, t.map?.[0]);
    const html = `<p class="katex-block">${math}</p>`;
    const eq = t.meta?.equation as { id: string; number: number } | undefined;
    if (!eq) return html + marker + '\n';
    return `<figure class="equation-figure" id="${escapeHtml(eq.id)}">${html}<figcaption class="eq-number">(${eq.number})${marker}</figcaption></figure>\n`;
  };
}
