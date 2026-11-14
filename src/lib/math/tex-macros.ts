/**
 * Registry macros inside TeX strings, for the exporters.
 *
 * Every output format needs the same two operations on the document's math:
 *  - which registry symbols does it use — including symbols that only occur
 *    inside other symbols' bodies (\arReals → \arDsHah)?
 *  - expand those macros (Typst/mitex and Pandoc cannot define them).
 * Each exporter supplies its own body for a symbol (LaTeX, KaTeX, Pandoc…).
 */
import type { MathSymbol } from './registry';

export type BodyOf = (sym: MathSymbol) => string;

/** Index of the `}` closing the `{` at `open`, or -1. Skips escaped braces. */
export function closingBrace(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function symbolMap(symbols: MathSymbol[]): Map<string, MathSymbol> {
  return new Map(symbols.map((s) => [s.name, s]));
}

/** Names of all `\commands` in `tex` that are registry symbols. */
function directNames(tex: string, map: Map<string, MathSymbol>): string[] {
  const out: string[] = [];
  for (const m of tex.matchAll(/\\([A-Za-z]+)/g)) if (map.has(m[1])) out.push(m[1]);
  return out;
}

/**
 * Registry symbols used by `texts`, transitively through `bodyOf`, in
 * dependency order (a symbol comes after the symbols its body uses), so the
 * result can be emitted as \newcommand definitions in that order.
 */
export function collectUsedSymbols(texts: string[], symbols: MathSymbol[], bodyOf: BodyOf): MathSymbol[] {
  const map = symbolMap(symbols);
  const ordered: MathSymbol[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (name: string) => {
    const st = state.get(name);
    if (st === 'done' || st === 'visiting') return; // 'visiting' = cycle; validation forbids direct self-reference
    state.set(name, 'visiting');
    const sym = map.get(name)!;
    for (const dep of directNames(bodyOf(sym), map)) visit(dep);
    state.set(name, 'done');
    ordered.push(sym);
  };
  for (const t of texts) for (const name of directNames(t, map)) visit(name);
  return ordered;
}

/**
 * Expand registry macros in `tex` (recursively, up to `maxDepth` levels).
 * Arguments are brace groups; a macro missing its arguments is left as is.
 */
export function expandMacros(tex: string, symbols: MathSymbol[], bodyOf: BodyOf, maxDepth = 8): string {
  const map = symbolMap(symbols);
  let current = tex;
  for (let depth = 0; depth < maxDepth; depth++) {
    let changed = false;
    let out = '';
    let i = 0;
    while (i < current.length) {
      if (current[i] === '\\') {
        const m = /^\\([A-Za-z]+)/.exec(current.slice(i));
        if (m) {
          const sym = map.get(m[1]);
          if (sym) {
            let pos = i + m[0].length;
            const args: string[] = [];
            let ok = true;
            for (let a = 0; a < (sym.arity ?? 0); a++) {
              while (pos < current.length && /\s/.test(current[pos])) pos++;
              if (current[pos] !== '{') {
                ok = false;
                break;
              }
              const end = closingBrace(current, pos);
              if (end === -1) {
                ok = false;
                break;
              }
              args.push(current.slice(pos + 1, end));
              pos = end + 1;
            }
            if (ok) {
              const body = bodyOf(sym).replace(/#(\d)/g, (_x, n: string) => `{${args[Number(n) - 1] ?? ''}}`);
              // Insert the body as is: wrapping it in {…} would turn an operator
              // into an ordinary group (\rsum_{…} would lose its limits). Add a
              // space only where a trailing \command would swallow the next letter.
              const next = current[pos] ?? '';
              out += /\\[A-Za-z]+$/.test(body) && /[A-Za-z]/.test(next) ? `${body} ` : body;
              i = pos;
              changed = true;
              continue;
            }
          }
          out += m[0];
          i += m[0].length;
          continue;
        }
      }
      out += current[i++];
    }
    current = out;
    if (!changed) break;
  }
  return current;
}

/** Remove `\cmd{…}` wrappers, keeping their content (brace-aware, nested). */
export function unwrapCommand(s: string, command: string): string {
  const token = command + '{';
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s.startsWith(token, i)) {
      const open = i + command.length;
      const end = closingBrace(s, open);
      if (end !== -1) {
        out += unwrapCommand(s.slice(open + 1, end), command);
        i = end + 1;
        continue;
      }
    }
    out += s[i++];
  }
  return out;
}

/** `\htmlClass{classes}{body}` → body (KaTeX-only command), recursively. */
export function stripHtmlClass(s: string, keep?: (classes: string, body: string) => string | null): string {
  const token = '\\htmlClass{';
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s.startsWith(token, i)) {
      const cOpen = i + token.length - 1;
      const cEnd = closingBrace(s, cOpen);
      if (cEnd !== -1 && s[cEnd + 1] === '{') {
        const bEnd = closingBrace(s, cEnd + 1);
        if (bEnd !== -1) {
          const classes = s.slice(cOpen + 1, cEnd);
          const body = stripHtmlClass(s.slice(cEnd + 2, bEnd), keep);
          out += keep?.(classes, body) ?? `{${body}}`;
          i = bEnd + 1;
          continue;
        }
      }
    }
    out += s[i++];
  }
  return out;
}
