/**
 * Registry → `\newcommand` header for Pandoc (`latex_macros`).
 *
 * Only symbols actually used in the document are emitted. The KaTeX body is
 * preferred for conversion where possible; `\textarabic` and `\reflectbox`
 * (LaTeX-only wrappers) are removed so Pandoc's TeX reader can handle the rest.
 */
import { getSymbols, type MathSymbol } from './registry';

/** Remove a one-argument command wrapper, keeping its content (brace-aware). */
function unwrapCommand(s: string, command: string): string {
  const token = command + '{';
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s.startsWith(token, i)) {
      const start = i + token.length;
      let depth = 1;
      let j = start;
      while (j < s.length && depth > 0) {
        if (s[j] === '{') depth++;
        else if (s[j] === '}') depth--;
        if (depth === 0) break;
        j++;
      }
      if (depth === 0) {
        out += unwrapCommand(s.slice(start, j), command);
        i = j + 1;
        continue;
      }
    }
    out += s[i++];
  }
  return out;
}

function pandocBody(sym: MathSymbol): string {
  let body = sym.latex.body;
  body = unwrapCommand(body, '\\reflectbox');
  body = body.replace(/\\textarabic\b/g, '\\text');
  // texmath has no \mathord; the char itself has the right atom class.
  body = body.replace(/\\mathord\{([^{}]*)\}/g, '$1');
  return body;
}

/** Expand registry macros inside one math expression (Pandoc cannot do this in display math). */
function expandMath(math: string, symbols: MathSymbol[]): string {
  let out = '';
  let i = 0;
  while (i < math.length) {
    if (math[i] === '\\') {
      const m = /^\\([A-Za-z]+)/.exec(math.slice(i));
      if (m) {
        const sym = symbols.find((s) => s.name === m[1]);
        if (sym) {
          let pos = i + m[0].length;
          const args: string[] = [];
          let ok = true;
          for (let a = 0; a < (sym.arity ?? 0); a++) {
            while (pos < math.length && /\s/.test(math[pos])) pos++;
            if (math[pos] !== '{') { ok = false; break; }
            let depth = 1;
            let j = pos + 1;
            while (j < math.length && depth > 0) {
              if (math[j] === '{') depth++;
              else if (math[j] === '}') depth--;
              if (depth === 0) break;
              j++;
            }
            if (depth !== 0) { ok = false; break; }
            args.push(math.slice(pos + 1, j));
            pos = j + 1;
          }
          if (ok) {
            out += pandocBody(sym).replace(/#(\d)/g, (_x, n: string) => `{${args[Number(n) - 1] ?? ''}}`);
            i = pos;
            continue;
          }
        }
      }
    }
    out += math[i++];
  }
  return out;
}

/** Expand registry macros inside `$…$` / `$$…$$` segments only. */
export function expandPandocMacros(text: string, symbols: MathSymbol[] = getSymbols()): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '$') {
      const display = text.startsWith('$$', i);
      const delim = display ? '$$' : '$';
      const end = text.indexOf(delim, i + delim.length);
      if (end !== -1) {
        out += delim + expandMath(text.slice(i + delim.length, end), symbols) + delim;
        i = end + delim.length;
        continue;
      }
    }
    out += text[i++];
  }
  return out;
}

/** Symbols whose `\name` appears in `text` (not as a prefix of a longer name). */
export function usedSymbols(text: string, symbols: MathSymbol[] = getSymbols()): MathSymbol[] {
  return symbols.filter((s) => new RegExp(`\\\\${s.name}(?![A-Za-z])`).test(text));
}

/** `\newcommand` definitions for the symbols used in `text`. */
export function toPandocHeader(text: string, symbols: MathSymbol[] = getSymbols()): string {
  const used = usedSymbols(text, symbols);
  if (used.length === 0) return '';
  return used
    .map((s) => {
      const arity = s.arity && s.arity > 0 ? `[${s.arity}]` : '';
      return `\\newcommand{\\${s.name}}${arity}{${pandocBody(s)}}`;
    })
    .join('\n');
}
