/**
 * Structural core rules — everything that used to be regex pre-/post-
 * processing around markdown-it, now done on the token stream:
 *
 *  before inline parsing
 *   sw_table_captions  "Table: …" / "جدول: …" paragraph before a table → caption
 *   sw_split_lines     each source line of a paragraph is its own paragraph
 *                      (the app's "Enter = new paragraph" convention; each
 *                      line also gets its own direction)
 *  after inline parsing
 *   sw_hidden_breaks   line breaks inside tight list items become <br>
 *   sw_gloss           word{%gloss%} → interlinear gloss
 *   sw_digits          Arabic-Indic digits in prose text tokens only
 *   sw_number          equations, figures, tables, citations, dir attributes
 *   sw_resolve         [ref:…] cross-references (after all numbers are known)
 */
import type MarkdownIt from 'markdown-it';
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import { CitationTracker } from '../bibliography';
import { escapeHtml, hasArabic, labelLanguage, type RenderEnv } from './env';

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const CAPTION_RE = /^(?:Table|جدول):\s*/;
const GLOSS_RE = /(\S+)\{%([^%]+)%\}/g;

const LABELS = {
  figure: { ar: 'الشكل', en: 'Figure' },
  table: { ar: 'جدول', en: 'Table' },
};

/* ── before inline ── */

function tableCaptions(state: StateCore): void {
  const t = state.tokens;
  for (let i = 3; i < t.length; i++) {
    if (t[i].type !== 'table_open') continue;
    const close = t[i - 1], inline = t[i - 2], open = t[i - 3];
    if (close.type !== 'paragraph_close' || inline.type !== 'inline' || open.type !== 'paragraph_open') continue;
    if (open.level !== t[i].level || !CAPTION_RE.test(inline.content)) continue;
    const caption = inline.content.replace(CAPTION_RE, '').replace(/\s*\n\s*/g, ' ').trim();
    t[i].meta = { ...(t[i].meta || {}), caption };
    t.splice(i - 3, 3);
    i -= 3;
  }
}

function splitLines(state: StateCore): void {
  const src = state.tokens;
  const out: Token[] = [];
  for (let i = 0; i < src.length; i++) {
    const open = src[i];
    if (
      open.type === 'paragraph_open' &&
      !open.hidden &&
      src[i + 1]?.type === 'inline' &&
      src[i + 1].content.includes('\n')
    ) {
      const inline = src[i + 1];
      const close = src[i + 2];
      const lines = inline.content.split('\n');
      const startLine = open.map?.[0] ?? 0;
      lines.forEach((line, k) => {
        const text = line.trim();
        if (!text) return;
        const map: [number, number] = [startLine + k, startLine + k + 1];
        const o = new state.Token('paragraph_open', 'p', 1);
        Object.assign(o, { block: true, level: open.level, map });
        const n = new state.Token('inline', '', 0);
        Object.assign(n, { content: text, level: inline.level, map, children: [] });
        const c = new state.Token('paragraph_close', 'p', -1);
        Object.assign(c, { block: true, level: close.level });
        out.push(o, n, c);
      });
      i += 2;
      continue;
    }
    out.push(open);
  }
  state.tokens = out;
}

/* ── after inline ── */

function hiddenBreaks(state: StateCore): void {
  const t = state.tokens;
  for (let i = 1; i < t.length; i++) {
    if (t[i].type !== 'inline' || !t[i - 1].hidden) continue;
    for (const c of t[i].children ?? []) {
      if (c.type === 'softbreak') {
        c.type = 'hardbreak';
        c.tag = 'br';
      }
    }
  }
}

function gloss(state: StateCore): void {
  for (const block of state.tokens) {
    if (block.type !== 'inline' || !block.children?.length) continue;
    const children: Token[] = [];
    for (const tok of block.children) {
      if (tok.type !== 'text' || !tok.content.includes('{%')) {
        children.push(tok);
        continue;
      }
      let last = 0;
      for (const m of tok.content.matchAll(GLOSS_RE)) {
        const at = m.index ?? 0;
        if (at > last) children.push(textToken(state, tok.content.slice(last, at)));
        const g = new state.Token('sw_gloss', '', 0);
        g.meta = { base: m[1], gloss: m[2] };
        g.content = m[0];
        children.push(g);
        last = at + m[0].length;
      }
      if (last < tok.content.length) children.push(textToken(state, tok.content.slice(last)));
    }
    block.children = children;
  }
}

function textToken(state: StateCore, content: string): Token {
  const t = new state.Token('text', '', 0);
  t.content = content;
  return t;
}

export function toArabicIndic(text: string): string {
  return text.replace(/[0-9]/g, (d) => ARABIC_INDIC[+d]);
}

/** Text a cell's digit decision is based on: the whole table row (as before), else the block. */
function digitContext(tokens: Token[], i: number): string {
  if (tokens[i - 1]?.type === 'td_open' || tokens[i - 1]?.type === 'th_open') {
    let parts = '';
    for (let j = i; j >= 0 && tokens[j].type !== 'tr_open'; j--) {
      if (tokens[j].type === 'inline') parts += tokens[j].content + ' ';
    }
    for (let j = i + 1; j < tokens.length && tokens[j].type !== 'tr_close'; j++) {
      if (tokens[j].type === 'inline') parts += tokens[j].content + ' ';
    }
    return parts;
  }
  return tokens[i].content;
}

function digits(state: StateCore): void {
  const env = state.env as RenderEnv;
  const style = env.options?.digitStyle ?? 'auto';
  if (style === 'western') return;
  const t = state.tokens;
  for (let i = 0; i < t.length; i++) {
    const block = t[i];
    if (block.type !== 'inline' || !block.children) continue;
    if (style === 'auto' && !hasArabic(digitContext(t, i))) continue;
    let inLink = 0;
    for (const c of block.children) {
      if (c.type === 'link_open') inLink++;
      else if (c.type === 'link_close') inLink--;
      else if (c.type === 'text' && inLink === 0) c.content = toArabicIndic(c.content);
    }
  }
}

function figureId(src: string, used: Set<string>): string {
  const base =
    src.replace(/^.*[/\\]/, '').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-') || 'figure';
  let id = `fig-${base}`;
  if (used.has(id)) {
    let i = 2;
    while (used.has(`fig-${base}-${i}`)) i++;
    id = `fig-${base}-${i}`;
  }
  used.add(id);
  return id;
}

function inlineText(tokens: Token[], from: number, closeType: string): string {
  let s = '';
  for (let j = from; j < tokens.length && tokens[j].type !== closeType; j++) {
    if (tokens[j].type === 'inline') s += tokens[j].content + ' ';
  }
  return s;
}

function number(state: StateCore): void {
  const env = state.env as RenderEnv;
  const t = state.tokens;
  const citations = new CitationTracker(env.options?.bibEntries ?? []);
  const figIds = new Set<string>();
  let eqNum = 0, figNum = 0, tblNum = 0;

  for (let i = 0; i < t.length; i++) {
    const tok = t[i];
    switch (tok.type) {
      case 'paragraph_open':
        if (!tok.hidden) tok.attrSet('dir', 'auto');
        break;
      case 'heading_open':
      case 'blockquote_open':
      case 'th_open':
      case 'td_open':
      case 'list_item_open':
        tok.attrSet('dir', 'auto');
        break;
      case 'bullet_list_open':
      case 'ordered_list_open': {
        const first = t.slice(i + 1).find((x) => x.type === 'inline');
        tok.attrSet('dir', first && hasArabic(first.content) ? 'rtl' : 'ltr');
        break;
      }
      case 'math_block': {
        eqNum++;
        const label: string | undefined = tok.meta?.label;
        const id = label ? `eq:${label}` : `eq-${eqNum}`;
        tok.meta = { ...(tok.meta || {}), equation: { id, number: eqNum } };
        env.equations.push({ id, number: eqNum, label, latex: tok.content.trim(), line: tok.map?.[0] });
        break;
      }
      case 'table_open': {
        tblNum++;
        const text = inlineText(t, i + 1, 'table_close');
        const caption: string = tok.meta?.caption ?? '';
        const lang = labelLanguage(env, text);
        tok.meta = {
          ...(tok.meta || {}),
          table: { id: `tbl-${tblNum}`, number: tblNum, caption, label: LABELS.table[lang], dir: hasArabic(text) ? 'rtl' : 'ltr' },
        };
        env.tables.push({ id: `tbl-${tblNum}`, number: tblNum, caption });
        break;
      }
      case 'inline':
        for (const c of tok.children ?? []) {
          if (c.type === 'image') {
            figNum++;
            const src = c.attrGet('src') || '';
            const alt = c.content || '';
            const id = figureId(src, figIds);
            const label = LABELS.figure[labelLanguage(env, alt)];
            c.meta = { ...(c.meta || {}), figure: { id, number: figNum, label } };
            env.figures.push({ id, number: figNum, src, caption: alt.trim() });
          } else if (c.type === 'sw_citation') {
            c.meta.formatted = citations.formatGroup(c.meta.keys);
          }
        }
        break;
    }
  }

  env.citations = { used: citations.usedKeys, missing: citations.missingKeys };
  for (const key of citations.missingKeys) {
    env.warnings.push({ kind: 'citation', message: `مرجع غير موجود: ${key}` });
  }
}

/** Text for a resolved block reference ("Theorem 2"); set by the academic-blocks plugin. */
export type BlockRefText = (type: string, number: number) => string | null;

function resolver(blockRefText: () => BlockRefText | null) {
  return function resolve(state: StateCore): void {
    const env = state.env as RenderEnv;
    const eqs = new Map<string, { id: string; number: number }>();
    for (const e of env.equations) {
      if (e.label) eqs.set(e.label, e);
      eqs.set(String(e.number), e);
    }
    const blocks = new Map<string, { id: string; type: string; number: number }>();
    for (const b of env.blocks) {
      if (b.label) blocks.set(`${b.type}:${b.label}`, b);
      blocks.set(`${b.type}:${b.id}`, b);
    }
    const text = blockRefText();
    for (const block of state.tokens) {
      if (block.type !== 'inline') continue;
      for (const c of block.children ?? []) {
        if (c.type !== 'sw_xref') continue;
        const { kind, ref } = c.meta as { kind: string; ref: string };
        if (kind === 'eq') {
          const eq = eqs.get(ref);
          if (eq) c.meta.target = { id: eq.id, text: `(${eq.number})`, cls: 'eq-ref' };
        } else {
          const b = blocks.get(`${kind}:${ref}`);
          const label = b && text ? text(b.type, b.number) : null;
          if (b && label) c.meta.target = { id: b.id, text: label, cls: 'block-ref' };
        }
        if (!c.meta.target) {
          env.warnings.push({ kind: 'ref', message: `مرجع داخلي غير معروف: ${c.content}`, line: block.map?.[0] });
        }
      }
    }
  };
}

/* ── renderers ── */

function renderers(md: MarkdownIt): void {
  md.renderer.rules.sw_gloss = (tokens: Token[], idx: number) => {
    const { base, gloss } = tokens[idx].meta;
    return `<span class="interlinear-unit"><span class="interlinear-base">${escapeHtml(base)}</span><span class="interlinear-gloss">${escapeHtml(gloss)}</span></span>`;
  };

  md.renderer.rules.image = (tokens: Token[], idx: number) => {
    const token = tokens[idx];
    const src = token.attrGet('src') || '';
    const alt = token.content || '';
    const title = token.attrGet('title');
    const fig = token.meta?.figure as { id: string; number: number; label: string } | undefined;
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy"${titleAttr} />`;
    if (!fig) return img;
    const captionText = alt ? `: ${escapeHtml(alt)}` : '';
    return `<figure class="figure" id="${fig.id}">\n    ${img}\n    <figcaption dir="auto">${fig.label} ${fig.number}${captionText}</figcaption>\n  </figure>`;
  };

  md.renderer.rules.table_open = (tokens: Token[], idx: number) => {
    const tbl = tokens[idx].meta?.table as
      | { id: string; number: number; caption: string; label: string; dir: string }
      | undefined;
    if (!tbl) return '<table>\n';
    const suffix = tbl.caption ? `: ${escapeHtml(tbl.caption)}` : '';
    return `<figure class="table-figure" id="${tbl.id}">\n<figcaption dir="auto">${tbl.label} ${tbl.number}${suffix}</figcaption>\n<table dir="${tbl.dir}">\n`;
  };

  md.renderer.rules.table_close = (tokens: Token[], idx: number) => {
    // find the matching open to know whether we wrapped it
    for (let j = idx; j >= 0; j--) {
      if (tokens[j].type === 'table_open') return tokens[j].meta?.table ? '</table>\n</figure>\n' : '</table>\n';
    }
    return '</table>\n';
  };
}

export function structurePlugin(md: MarkdownIt, opts: { blockRefText: () => BlockRefText | null }): void {
  md.core.ruler.after('block', 'sw_table_captions', tableCaptions);
  md.core.ruler.after('sw_table_captions', 'sw_split_lines', splitLines);
  md.core.ruler.push('sw_hidden_breaks', hiddenBreaks);
  md.core.ruler.push('sw_gloss', gloss);
  md.core.ruler.push('sw_digits', digits);
  md.core.ruler.push('sw_number', number);
  md.core.ruler.push('sw_resolve', resolver(opts.blockRefText));
  renderers(md);
}
