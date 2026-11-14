import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getSymbols, type MathSymbol } from '$lib/math';
import { collectUsedSymbols, expandMacros } from '$lib/math/tex-macros';
import { latexBodyOf, latexSymbolSetup, arabicInMathForLatex, textModeArabic } from '$lib/math/to-latex';
import { expandPandocMacros, toPandocHeader } from '$lib/math/to-pandoc';
import { parseDocument, detectLanguage } from '$lib/publishing/document';
import { LatexExporter } from '$lib/publishing/latex-exporter';
import { TypstExporter, mathForTypst, escapeTypst, MITEX_VERSION } from '$lib/publishing/typst-exporter';
import { parseBibTeX } from '$lib/bibliography';

const FIX = fileURLToPath(new URL('../../../tests/fixtures/', import.meta.url));
const bib = parseBibTeX('@book{smith2020, author={Smith, John}, title={A Book}, year={2020}}');

const SAMPLE = [
  '# مقدمة',
  '',
  String.raw`نص عربي مع English words ومعادلة $\jaa^2 س + 1$ ومرجع [@smith2020] وحاشية[^1].`,
  'انظر [ref:eq:limit] و [ref:eq:2].',
  '',
  '$$',
  String.raw`\nihaya_{س \to 0} \frac{\jaa س}{س} = 1`,
  '$$ {#eq:limit}',
  '',
  '$$',
  String.raw`\rsum_{ن=1}^{ك} ن \quad \rsqrt{س} \quad \arReals`,
  '$$',
  '',
  '$$[rtl]',
  String.raw`س \to 0`,
  '$$',
  '',
  ':::theorem {#t1} عنوان',
  'نص المبرهنة',
  ':::',
  '',
  '[^1]: حاشية.',
].join('\n');

/** Balanced \begin/\end environments and braces (ignoring escaped braces and comments). */
function latexStructureProblems(tex: string): string[] {
  const problems: string[] = [];
  const body = tex.split('\n').map((l) => l.replace(/(?<!\\)%.*$/, '')).join('\n');
  const stack: string[] = [];
  for (const m of body.matchAll(/\\(begin|end)\{([^}]+)\}/g)) {
    if (m[1] === 'begin') stack.push(m[2]);
    else if (stack.pop() !== m[2]) problems.push(`unbalanced \\end{${m[2]}}`);
  }
  if (stack.length) problems.push(`unclosed: ${stack.join(', ')}`);
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '\\') { i++; continue; }
    if (body[i] === '{') depth++;
    else if (body[i] === '}' && --depth < 0) { problems.push(`extra } at ${i}`); depth = 0; }
  }
  if (depth !== 0) problems.push(`${depth} unclosed {`);
  return problems;
}

describe('tex-macros (shared by LaTeX, Typst, Pandoc)', () => {
  it('collects used symbols transitively, dependencies first', () => {
    const used = collectUsedSymbols(['\\arReals + \\jaa x'], getSymbols(), latexBodyOf).map((s) => s.name);
    expect(used).toEqual(['arDsHah', 'arReals', 'jaa']);
  });

  it('expands recursively and keeps operators as operators', () => {
    const out = expandMacros('\\rsum_{i} \\arReals', getSymbols(), (s) => latexBodyOf(s));
    expect(out).toContain('\\operatorname*{\\swmirror{\\sum}}_{i}');
    expect(out).not.toContain('\\arReals');
    expect(out).not.toContain('\\arDsHah');
  });

  it('separates a trailing command from a following letter', () => {
    const syms: MathSymbol[] = [
      { name: 'foo', category: 'misc', labelAr: 'x', keywords: [], katex: { kind: 'macro', body: '\\alpha' }, latex: { body: '\\alpha' } },
    ];
    const body = (s: MathSymbol) => s.latex.body;
    expect(expandMacros('\\foo x', syms, body)).toBe('\\alpha x');
    expect(expandMacros('\\foo{}x', syms, body)).toBe('\\alpha{}x');
  });
});

describe('E3: registry → LaTeX', () => {
  it('defines only the used symbols, with \\swmirror and graphicx when mirrored ones are used', () => {
    const s = latexSymbolSetup(['\\rsum_{i} \\arReals']);
    expect(s.used).toEqual(['rsum', 'arDsHah', 'arReals']);
    expect(s.packages).toContain('graphicx');
    expect(s.definitions).toContain('\\newcommand{\\swmirror}[1]{\\mathpalette\\sw@mirror{#1}}');
    expect(s.definitions).toContain('\\DeclareRobustCommand{\\rsum}{\\operatorname*{\\swmirror{\\sum}}}');
    expect(s.definitions).not.toContain('htmlClass');
    expect(s.definitions).not.toContain('reflectbox{\\sum');
    expect(latexSymbolSetup(['x^2']).definitions).toBe('');
  });

  it('puts \\textarabic in text mode inside math', () => {
    expect(textModeArabic('\\operatorname{\\textarabic{جا}}')).toBe('\\operatorname{\\text{\\textarabic{جا}}}');
    expect(textModeArabic('\\text{\\textarabic{جا}}')).toBe('\\text{\\textarabic{جا}}');
    expect(latexBodyOf(getSymbols().find((s) => s.name === 'arComplex')!)).toBe('\\mathord{\\text{\\textbf{\\textarabic{ك}}}}');
  });

  it('wraps Arabic in math for XeLaTeX', () => {
    expect(arabicInMathForLatex('س + 1')).toBe('\\text{\\textarabic{س}} + 1');
    expect(arabicInMathForLatex('\\text{السرعة} = v')).toBe('\\text{\\textarabic{السرعة}} = v');
    expect(arabicInMathForLatex('\\jaa x')).toBe('\\jaa x');
  });

  it('exports a full Arabic document as structurally valid XeLaTeX', () => {
    const tex = new LatexExporter().export(parseDocument(SAMPLE, bib)).content as string;
    expect(latexStructureProblems(tex)).toEqual([]);
    expect(tex).toContain('\\setmainlanguage[numerals=mashriq]{arabic}');
    expect(tex).toContain('\\textenglish{English words}');
    expect(tex).toContain('\\eqref{eq:limit}');
    expect(tex).toContain('\\eqref{eq:2}');
    expect(tex).toContain('\\footnote{حاشية.}');
    expect(tex).toContain('% This equation is right-to-left');
    expect(tex).toContain('\\textbf{نظرية 1.}');
    expect(tex).not.toContain('\\section{مقدمة}'); // the title is \maketitle, not repeated
  });

  // The three cases below were found by compiling real exports with Tectonic (XeTeX).
  it('Arabic math-alphabet glyphs are drawn from Katib Math (\\swmathglyphs), not Computer Modern', () => {
    const s = latexSymbolSetup(['\\arDsBeh']);
    expect(s.definitions).toContain('\\newfontfamily\\swmathglyphs{KatibMath-Regular.otf}[Path=./]');
    expect(s.definitions).toContain(`\\DeclareRobustCommand{\\arDsBeh}{\\mathord{\\text{\\swmathglyphs ${String.fromCodePoint(0x1eea1)}}}}`);
  });

  it('inline code in Arabic switches language before font', () => {
    const tex = new LatexExporter().export(parseDocument('نص مع `code` هنا')).content as string;
    expect(tex).toContain('\\textenglish{\\texttt{code}}');
    expect(tex).not.toContain('\\texttt{\\textenglish');
  });

  it('a fence holding Arabic prose becomes an Arabic quote, not listings', () => {
    const tex = new LatexExporter().export(parseDocument('نص\n\n```\n(متن) قال المصنف\n(حاشية) شرح\n```')).content as string;
    expect(tex).toContain('\\begin{quote}\n(متن) قال المصنف \\\\\n(حاشية) شرح\n\\end{quote}');
    expect(tex).not.toContain('lstlisting}\n(متن)');
  });

  it('when the only H1 is the title, H2 becomes \\section (numbering starts at 1)', () => {
    const tex = new LatexExporter().export(parseDocument('# العنوان\n\n## فصل\n\n### مبحث')).content as string;
    expect(tex).toContain('\\section{فصل}');
    expect(tex).toContain('\\subsection{مبحث}');
    const typ = new TypstExporter().export(parseDocument('# العنوان\n\n## فصل')).content as string;
    expect(typ).toContain('\n= فصل');
    // with several H1s nothing shifts
    expect(new LatexExporter().export(parseDocument('# أ\n\n# ب\n\n## ج')).content).toContain('\\subsection{ج}');
  });

  it('Arabic-Indic numerals separate section numbers with "-" (٠ looks like a period)', () => {
    const mashriq = new LatexExporter().export(parseDocument('# ع\n\n## أ\n\n### ب')).content as string;
    expect(mashriq).toContain('\\renewcommand{\\thesubsection}{\\thesection-\\arabic{subsection}}');
    const west = parseDocument('# ع\n\n## أ');
    west.meta.digitStyle = 'western';
    expect(new LatexExporter().export(west).content).not.toContain('\\renewcommand{\\thesubsection}');
  });

  it('a numbered reference to a labelled equation uses the label', () => {
    const tex = new LatexExporter().export(parseDocument('$$\nx\n$$ {#eq:a}\n\n[ref:eq:1]')).content as string;
    expect(tex).toContain('\\eqref{eq:a}');
    expect(tex).not.toContain('\\eqref{eq:1}');
  });

  it('English documents with Arabic math use XeLaTeX with arabic as the other language', () => {
    const tex = new LatexExporter().export(parseDocument('# Notes\n\nThe limit $\\nihaya_{x \\to 0} f$ and السرعة.')).content as string;
    expect(tex).toContain('\\setmainlanguage{english}');
    expect(tex).toContain('\\setotherlanguage[numerals=maghrib]{arabic}');
    expect(tex).toContain('\\textarabic{السرعة}');
    expect(latexStructureProblems(tex)).toEqual([]);
  });

  it('pure-Latin documents stay on pdfLaTeX', () => {
    const tex = new LatexExporter().export(parseDocument('# Notes\n\nOnly $x^2$ here.')).content as string;
    expect(tex).toContain('\\usepackage[utf8]{inputenc}');
    expect(tex).not.toContain('polyglossia');
  });

  it('every fixture exports as structurally valid LaTeX', () => {
    for (const f of ['classical-book-intro.md', 'classical-matn-salah.md', 'code-and-table.md', 'interlinear-gloss.md', 'classical-hawashi.md']) {
      const tex = new LatexExporter().export(parseDocument(readFileSync(FIX + f, 'utf8'), bib)).content as string;
      expect(latexStructureProblems(tex), f).toEqual([]);
    }
  });
});

describe('E4: Typst via mitex', () => {
  it('expands registry macros for mitex; glyphs become characters; mirrored become plain', () => {
    expect(mathForTypst('\\arReals')).toBe(String.fromCodePoint(0x1eea7));
    expect(mathForTypst('\\jaa x')).toBe('\\operatorname{\\text{جا}} x');
    const m = mathForTypst('\\rsum_{i}');
    expect(m).toContain('\\sum');
    expect(m).not.toContain('htmlClass');
    expect(m).not.toContain('swmirror');
  });

  it('exports numbered, labelled equations and real references', () => {
    const typ = new TypstExporter().export(parseDocument(SAMPLE, bib)).content as string;
    expect(typ).toContain(`#import "@preview/mitex:${MITEX_VERSION}": mitex, mi`);
    // Arabic document: numbers on the left, Arabic-Indic digits
    expect(typ).toContain('#set math.equation(numbering: "(١)", number-align: left + horizon)');
    expect(typ).toContain('#show math.equation: set text(dir: ltr)');
    expect(typ).toMatch(/#mitex\("[^"]*"\) <eq:limit>/);
    expect(typ).toContain('@eq:limit');
    expect(typ).toContain('@eq-2');
    expect(typ).toContain('#footnote[حاشية.]');
    expect(typ).toContain('(Smith, 2020)');
    expect(typ).toContain('*نظرية 1.*');
    expect(typ).toContain('dir: rtl');
    // the old invalid "$x $ (1)$" form is gone
    expect(typ).not.toMatch(/\$ \(\d+\)\$/);
  });

  it('Western digit style and English documents number with (1)', () => {
    const ar = parseDocument('$$\nx\n$$\n\nنص عربي');
    ar.meta.digitStyle = 'western';
    expect(new TypstExporter().export(ar).content).toContain('numbering: "(1)", number-align: left');
    expect(new TypstExporter().export(parseDocument('English text\n\n$$\nx\n$$')).content).toContain(
      '#set math.equation(numbering: "(1)")\n',
    );
  });

  it('Latin citations in Arabic documents are isolated left-to-right', () => {
    const typ = new TypstExporter().export(parseDocument('نص عربي طويل [@smith2020]', bib)).content as string;
    expect(typ).toContain('#box(text(dir: ltr)[(Smith, 2020)])');
  });

  it('escapes Typst markup in prose', () => {
    expect(escapeTypst('a #b $c @d *e* _f_ <g> [h]')).toBe('a \\#b \\$c \\@d \\*e\\* \\_f\\_ \\<g\\> \\[h\\]');
  });
});

describe('Pandoc (DOCX) macros, now transitive', () => {
  it('expands nested registry symbols', () => {
    const out = expandPandocMacros('$\\arReals$');
    expect(out).toBe(`$${String.fromCodePoint(0x1eea7)}$`);
    expect(toPandocHeader('$\\arReals$')).toContain('\\newcommand{\\arDsHah}');
  });
});

describe('document language detection', () => {
  it('detects Arabic and English documents from prose (not math or code)', () => {
    expect(detectLanguage(parseDocument('هذا نص عربي طويل يحتوي على كلمة English واحدة').blocks)).toBe('ar');
    expect(detectLanguage(parseDocument('An English text with one كلمة').blocks)).toBe('en');
    expect(parseDocument('$$\nabc\n$$\n\nنص').meta.direction).toBe('rtl');
  });
});
