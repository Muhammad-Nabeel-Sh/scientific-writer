/**
 * Registry → `\newcommand` header for Pandoc (`latex_macros`).
 *
 * Only symbols actually used in the document are emitted — transitively, so
 * \arReals also brings \arDsHah. LaTeX-only wrappers (`\textarabic`,
 * `\swmirror`, `\reflectbox`, KaTeX's `\htmlClass`) are removed so Pandoc's
 * TeX reader can handle the rest. Word has no mirrored operators: they are
 * exported unmirrored.
 */
import { getSymbols, type MathSymbol } from './registry';
import { collectUsedSymbols, expandMacros, stripHtmlClass, unwrapCommand } from './tex-macros';

export function pandocBody(sym: MathSymbol): string {
  let body = stripHtmlClass(sym.latex.body);
  body = unwrapCommand(body, '\\swmirror');
  body = unwrapCommand(body, '\\reflectbox');
  body = body.replace(/\\textarabic\b/g, '\\text');
  // texmath has no \mathord; the char itself has the right atom class.
  body = body.replace(/\\mathord\{([^{}]*)\}/g, '$1');
  return body;
}

/** Expand registry macros inside `$…$` / `$$…$$` segments only (recursively). */
export function expandPandocMacros(text: string, symbols: MathSymbol[] = getSymbols()): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '$') {
      const display = text.startsWith('$$', i);
      const delim = display ? '$$' : '$';
      const end = text.indexOf(delim, i + delim.length);
      if (end !== -1) {
        out += delim + expandMacros(text.slice(i + delim.length, end), symbols, pandocBody) + delim;
        i = end + delim.length;
        continue;
      }
    }
    out += text[i++];
  }
  return out;
}

/** Symbols used in `text`, including those used by their bodies, in dependency order. */
export function usedSymbols(text: string, symbols: MathSymbol[] = getSymbols()): MathSymbol[] {
  return collectUsedSymbols([text], symbols, pandocBody);
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
