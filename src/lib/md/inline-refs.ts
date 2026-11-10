/**
 * Inline syntax that used to be handled by regexes over source or HTML:
 *
 *   [@key] / [@a; @b] / [@ms:key] / [@tab:key]   citation
 *   [ref:eq:label] / [ref:eq:3] / [ref:theorem:x] cross-reference
 *   [[Note name]] / [[Note name|shown text]]      wiki link
 *
 * As real tokens they are never matched inside code spans, math or link
 * URLs, and digit conversion leaves them alone. Citations are resolved and
 * cross-references collected in the numbering pass (structure.ts); the
 * renderers here only print what that pass decided.
 */
import type MarkdownIt from 'markdown-it';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import { escapeHtml, type RenderEnv } from './env';

/** Find the `]` closing a `[` at `start`, ignoring nested brackets. -1 if none. */
function closingBracket(src: string, start: number, max: number): number {
  let depth = 0;
  for (let i = start; i < max; i++) {
    const c = src.charCodeAt(i);
    if (c === 0x5c /* \ */) { i++; continue; }
    if (c === 0x5b /* [ */) depth++;
    else if (c === 0x5d /* ] */) {
      depth--;
      if (depth === 0) return i;
    }
    else if (c === 0x0a && depth > 0 && src.charCodeAt(i + 1) === 0x0a) return -1;
  }
  return -1;
}

function citation(state: StateInline, silent: boolean): boolean {
  const { src, pos, posMax } = state;
  if (src.charCodeAt(pos) !== 0x5b || src.charCodeAt(pos + 1) !== 0x40 /* @ */) return false;
  const end = closingBracket(src, pos, posMax);
  if (end < 0) return false;
  const keys = src
    .slice(pos + 1, end)
    .split(';')
    .map((k) => k.trim().replace(/^@/, ''))
    .filter(Boolean);
  if (keys.length === 0) return false;
  if (!silent) {
    const t = state.push('sw_citation', '', 0);
    t.content = src.slice(pos, end + 1);
    t.meta = { keys };
  }
  state.pos = end + 1;
  return true;
}

const XREF_RE = /^\[ref:([A-Za-z][\w-]*):([^\]\s]+)\]/;

function xref(state: StateInline, silent: boolean): boolean {
  if (state.src.charCodeAt(state.pos) !== 0x5b) return false;
  const m = XREF_RE.exec(state.src.slice(state.pos, state.posMax));
  if (!m) return false;
  if (!silent) {
    const t = state.push('sw_xref', '', 0);
    t.content = m[0];
    t.meta = { kind: m[1], ref: m[2] };
  }
  state.pos += m[0].length;
  return true;
}

const WIKI_RE = /^\[\[([^\]|\n]+)(?:\|([^\]\n]*))?\]\]/;

function wikiLink(state: StateInline, silent: boolean): boolean {
  if (state.src.charCodeAt(state.pos) !== 0x5b || state.src.charCodeAt(state.pos + 1) !== 0x5b) return false;
  const m = WIKI_RE.exec(state.src.slice(state.pos, state.posMax));
  if (!m) return false;
  if (!silent) {
    const t = state.push('sw_wikilink', '', 0);
    t.content = m[0];
    t.meta = { target: m[1].trim(), display: m[2]?.trim() || undefined };
  }
  state.pos += m[0].length;
  return true;
}

export function inlineRefsPlugin(md: MarkdownIt): void {
  md.inline.ruler.before('link', 'sw_wikilink', wikiLink);
  md.inline.ruler.before('link', 'sw_citation', citation);
  md.inline.ruler.before('link', 'sw_xref', xref);

  md.renderer.rules.sw_citation = (tokens: Token[], idx: number) => {
    const text = tokens[idx].meta?.formatted as string | undefined;
    return escapeHtml(text ?? tokens[idx].content);
  };

  md.renderer.rules.sw_xref = (tokens: Token[], idx: number) => {
    const t = tokens[idx];
    const target = t.meta?.target as { id: string; text: string; cls: string } | undefined;
    if (target) {
      return `<a href="#${escapeHtml(target.id)}" class="${target.cls}">${escapeHtml(target.text)}</a>`;
    }
    const cls = t.meta.kind === 'eq' ? 'eq-ref-unresolved' : 'block-ref-unresolved';
    return `<span class="${cls}">${escapeHtml(t.content)}</span>`;
  };

  md.renderer.rules.sw_wikilink = (tokens: Token[], idx: number, _o, env: RenderEnv) => {
    const t = tokens[idx];
    const resolve = env.options?.resolveWikiLink;
    if (!resolve) return escapeHtml(t.content);
    const label = escapeHtml(t.meta.display || t.meta.target);
    const id = resolve(t.meta.target);
    if (id) {
      return `<a href="#" class="wiki-link wiki-link-resolved" data-note-id="${escapeHtml(id)}">${label}</a>`;
    }
    return `<span class="wiki-link wiki-link-missing">${label}</span>`;
  };
}
