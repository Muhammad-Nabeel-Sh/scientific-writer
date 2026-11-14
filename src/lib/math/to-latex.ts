/**
 * Registry → LaTeX (E3).
 *
 * The exported .tex defines only the symbols the document uses (and the
 * symbols those depend on), in dependency order, plus small helpers:
 *   \swmirror{…}  horizontal flip that keeps the math style (\mathpalette),
 *                 so mirrored big operators stay large and keep their limits.
 * Arabic inside math is wrapped in \textarabic so polyglossia shapes it with
 * the Arabic font in both Arabic and English documents.
 */
import { getSymbols, type MathSymbol } from './registry';
import { closingBrace, collectUsedSymbols, stripHtmlClass } from './tex-macros';

const ARABIC_RUN = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿](?:[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿\s.،]*[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿])?/g;

const ATOM_COMMAND = { mathord: '\\mathord', mathop: '\\mathop', mathrel: '\\mathrel', mathbin: '\\mathbin' } as const;

/**
 * A symbol's LaTeX body, with KaTeX-only commands translated.
 *
 * Glyph symbols whose LaTeX body is just their character (the Arabic math
 * alphabet, ؆ ؇ ٪ …) are drawn from Katib Math through \swmathglyphs:
 * unicode-math does not map those code points, so in plain math mode XeTeX
 * would look for them in Computer Modern and drop them (verified with
 * Tectonic 0.17: "Missing character … in font cmmi12").
 */
export function latexBodyOf(sym: MathSymbol): string {
  if (sym.katex.kind === 'glyph' && sym.latex.body === sym.katex.char) {
    return `${ATOM_COMMAND[sym.katex.atom]}{\\text{\\swmathglyphs ${sym.katex.char}}}`;
  }
  const body = stripHtmlClass(sym.latex.body, (classes, inner) =>
    classes.split(/\s+/).includes('sw-mirror') ? `\\swmirror{${inner}}` : null,
  );
  return textModeArabic(body);
}

const SWMATHGLYPHS_DEF = [
  '% \\swmathglyphs: Katib Math as a text font, for Arabic math-alphabet glyphs',
  '% that unicode-math does not map into math mode',
  '\\newfontfamily\\swmathglyphs{KatibMath-Regular.otf}[Path=./]',
].join('\n');

/**
 * polyglossia's \textarabic is a text command: in math it must sit inside
 * amsmath's \text{…}. Wrap every \textarabic{…} that is not already the
 * whole content of a \text{…} group.
 */
export function textModeArabic(tex: string): string {
  const token = '\\textarabic{';
  let out = '';
  let i = 0;
  while (i < tex.length) {
    if (tex.startsWith(token, i)) {
      const open = i + token.length - 1;
      const end = closingBrace(tex, open);
      if (end !== -1) {
        const group = tex.slice(i, end + 1);
        const insideText = /\\text(?:bf|it|rm)?\{$/.test(out) && tex[end + 1] === '}';
        out += insideText ? group : `\\text{${group}}`;
        i = end + 1;
        continue;
      }
    }
    out += tex[i++];
  }
  return out;
}

const SWMIRROR_DEF = [
  '% \\swmirror{x}: x flipped horizontally, keeping the current math style',
  '\\makeatletter',
  '\\newcommand{\\swmirror}[1]{\\mathpalette\\sw@mirror{#1}}',
  '\\newcommand{\\sw@mirror}[2]{\\reflectbox{$\\m@th#1#2$}}',
  '\\makeatother',
].join('\n');

export interface LatexSymbolSetup {
  /** Extra packages the definitions need. */
  packages: string[];
  /** Definitions to put in the preamble ('' when nothing is used). */
  definitions: string;
  /** Names of the symbols defined. */
  used: string[];
}

/** Preamble definitions for the registry symbols used in `mathTexts`. */
export function latexSymbolSetup(mathTexts: string[], symbols: MathSymbol[] = getSymbols()): LatexSymbolSetup {
  const used = collectUsedSymbols(mathTexts, symbols, latexBodyOf);
  if (used.length === 0) return { packages: [], definitions: '', used: [] };
  const packages = new Set<string>();
  const lines: string[] = ['% ── Arabic math symbols (الكاتب العلمي symbol registry) ──'];
  const bodies = used.map((s) => latexBodyOf(s));
  if (bodies.some((b) => b.includes('\\swmirror'))) {
    packages.add('graphicx');
    lines.push(SWMIRROR_DEF);
  }
  if (bodies.some((b) => b.includes('\\swmathglyphs'))) lines.push(SWMATHGLYPHS_DEF);
  used.forEach((s, i) => {
    for (const p of s.latex.packages ?? []) packages.add(p);
    const arity = s.arity && s.arity > 0 ? `[${s.arity}]` : '';
    // \DeclareRobustCommand: never a compile error if a package defines the same name.
    lines.push(`\\DeclareRobustCommand{\\${s.name}}${arity}{${bodies[i]}}`);
  });
  return { packages: [...packages], definitions: lines.join('\n'), used: used.map((s) => s.name) };
}

/**
 * Prepare one formula for XeLaTeX: Arabic runs inside \text{…} get
 * \textarabic{…}; bare Arabic in math becomes \text{\textarabic{…}} (math
 * fonts do not shape Arabic). Content already in \textarabic is left alone.
 */
export function arabicInMathForLatex(tex: string): string {
  let out = '';
  let i = 0;
  while (i < tex.length) {
    // skip existing \textarabic{…} untouched
    if (tex.startsWith('\\textarabic{', i)) {
      let depth = 0;
      let j = i + '\\textarabic'.length;
      for (; j < tex.length; j++) {
        if (tex[j] === '{') depth++;
        else if (tex[j] === '}' && --depth === 0) break;
      }
      out += tex.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    // inside \text{…}: wrap Arabic runs only
    const textCmd = /^\\(text|textrm|textbf|textit|mathrm|operatorname\*?)\{/.exec(tex.slice(i));
    if (textCmd) {
      const open = i + textCmd[0].length - 1;
      let depth = 0;
      let j = open;
      for (; j < tex.length; j++) {
        if (tex[j] === '\\') { j++; continue; }
        if (tex[j] === '{') depth++;
        else if (tex[j] === '}' && --depth === 0) break;
      }
      const inner = tex.slice(open + 1, j);
      out += tex.slice(i, open + 1) + arabicInMathForLatexText(inner) + '}';
      i = j + 1;
      continue;
    }
    if (tex[i] === '\\') {
      const m = /^\\[A-Za-z]+|^\\./.exec(tex.slice(i));
      out += m ? m[0] : '\\';
      i += m ? m[0].length : 1;
      continue;
    }
    ARABIC_RUN.lastIndex = i;
    const run = ARABIC_RUN.exec(tex);
    if (run && run.index === i) {
      out += `\\text{\\textarabic{${run[0]}}}`;
      i += run[0].length;
      continue;
    }
    out += tex[i++];
  }
  return out;
}

function arabicInMathForLatexText(inner: string): string {
  if (inner.includes('\\textarabic')) return inner;
  return inner.replace(ARABIC_RUN, (run) => `\\textarabic{${run}}`);
}
