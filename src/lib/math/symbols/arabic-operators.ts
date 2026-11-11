/**
 * Arabic-notation operators and signs.
 *
 * MIRRORED_OPERATORS — ∑ ∫ √ ∂ ∃ … drawn mirrored, for Arabic-style notation
 *   inside left-to-right formulas. They are KaTeX's own operators wrapped in
 *   \htmlClass{sw-mirror}{…} (a CSS horizontal flip, app.css), so size,
 *   limits and spacing stay exactly those of the original. In right-to-left
 *   equations ($$[rtl]) every operator is mirrored automatically by Katib
 *   Math's 'rtlm' forms; there these symbols look the same as the plain ones.
 *   Radicals flip only the sign: their content is flipped back.
 *
 * ARABIC_SIGNS — the Arabic-script math signs Unicode defines (؆ ؇ ؈ ٪ ؉ ؊).
 *
 * NUMBER_SETS — Arabic number-set letters: ط ص ن ح (double-struck forms from
 *   the Arabic math alphabet) and ك (Unicode has no double-struck Kaf, so a
 *   bold Kaf stands in).
 */
import type { MathSymbol, GlyphAtom } from '../registry';

const M = (body: string) => `\\htmlClass{sw-mirror}{${body}}`;

function mirrored(
  name: string,
  body: string,
  labelAr: string,
  keywords: string[],
  arity: 0 | 1 | 2 = 0,
): MathSymbol {
  return {
    name,
    category: 'operator',
    labelAr,
    keywords: [...keywords, 'معكوس', 'mirrored', 'reversed'],
    arity,
    katex: { kind: 'macro', body },
    // LaTeX export (Phase 4): \reflectbox from graphicx gives the same flip.
    latex: { body: body.replaceAll('\\htmlClass{sw-mirror}', '\\reflectbox'), packages: ['graphicx'] },
    mirrorInRtl: true,
  };
}

/** Big operator with limits under/over in display style (like \sum). */
const bigOp = (cmd: string) => `\\operatorname*{${M(cmd)}}`;
/** Big operator with limits at the side (like \int). */
const intOp = (cmd: string) => `\\mathop{${M(cmd)}}\\nolimits`;

export const MIRRORED_OPERATORS: MathSymbol[] = [
  mirrored('rsum', bigOp('\\sum'), 'مجموع معكوس', ['مجموع', 'sum', '∑']),
  mirrored('rint', intOp('\\int'), 'تكامل معكوس', ['تكامل', 'integral', '∫']),
  mirrored('riint', intOp('\\iint'), 'تكامل ثنائي معكوس', ['تكامل ثنائي', 'double integral', '∬']),
  mirrored('riiint', intOp('\\iiint'), 'تكامل ثلاثي معكوس', ['تكامل ثلاثي', 'triple integral', '∭']),
  mirrored('roint', intOp('\\oint'), 'تكامل خطي مغلق معكوس', ['تكامل مغلق', 'contour integral', '∮']),
  mirrored('roiint', intOp('\\oiint'), 'تكامل سطحي مغلق معكوس', ['تكامل سطحي', 'surface integral', '∯']),
  mirrored('rsqrt', M(`\\sqrt{${M('#1')}}`), 'جذر معكوس', ['جذر', 'جذر تربيعي', 'sqrt', 'root', '√'], 1),
  mirrored('rroot', M(`\\sqrt[${M('#1')}]{${M('#2')}}`), 'جذر نوني معكوس', ['جذر', 'جذر نوني', 'nth root', 'root'], 2),
  mirrored('rpartial', M('\\partial'), 'مشتقة جزئية معكوسة', ['مشتقة جزئية', 'partial', '∂']),
  mirrored('rexists', M('\\exists'), 'يوجد (معكوس)', ['يوجد', 'exists', '∃']),
  mirrored('rnexists', M('\\nexists'), 'لا يوجد (معكوس)', ['لا يوجد', 'not exists', '∄']),
  mirrored('ranglesign', M('\\angle'), 'زاوية معكوسة', ['زاوية', 'angle', '∠']),
  mirrored('rmeasuredangle', M('\\measuredangle'), 'زاوية مقيسة معكوسة', ['زاوية', 'measured angle', '∡']),
  mirrored('rpropto', `\\mathrel{${M('\\propto')}}`, 'يتناسب مع (معكوس)', ['يتناسب', 'تناسب', 'proportional', '∝']),
  mirrored('rcomplement', M('\\complement'), 'متمّمة معكوسة', ['متممة', 'complement', '∁']),
];

function sign(name: string, cp: number, labelAr: string, keywords: string[], atom: GlyphAtom): MathSymbol {
  const char = String.fromCodePoint(cp);
  return {
    name,
    category: 'misc',
    labelAr,
    keywords,
    unicode: char,
    katex: { kind: 'glyph', char, font: 'arabicmath', atom },
    latex: { body: char },
    typst: char,
  };
}

export const ARABIC_SIGNS: MathSymbol[] = [
  sign('arCubeRoot', 0x0606, 'جذر تكعيبي عربي ؆', ['جذر تكعيبي', 'cube root', 'cbrt'], 'mathop'),
  sign('arFourthRoot', 0x0607, 'جذر رابع عربي ؇', ['جذر رابع', 'fourth root'], 'mathop'),
  sign('arRay', 0x0608, 'شعاع ؈', ['شعاع', 'ray', 'نصف مستقيم'], 'mathord'),
  sign('arPercent', 0x066a, 'نسبة مئوية ٪', ['نسبة مئوية', 'percent', '%'], 'mathord'),
  sign('arPermille', 0x0609, 'في الألف ؉', ['في الألف', 'per mille', '‰'], 'mathord'),
  sign('arPerTenThousand', 0x060a, 'في العشرة آلاف ؊', ['في العشرة آلاف', 'per ten thousand', '‱'], 'mathord'),
];

function numberSet(name: string, body: string, labelAr: string, keywords: string[]): MathSymbol {
  return {
    name,
    category: 'misc',
    labelAr,
    keywords: [...keywords, 'مجموعة', 'أعداد', 'number set'],
    katex: { kind: 'macro', body },
    latex: { body },
  };
}

export const NUMBER_SETS: MathSymbol[] = [
  numberSet('arNaturals', '\\arDsTah', 'الأعداد الطبيعية ط', ['طبيعية', 'naturals', 'ℕ']),
  numberSet('arIntegers', '\\arDsSad', 'الأعداد الصحيحة ص', ['صحيحة', 'integers', 'ℤ']),
  numberSet('arRationals', '\\arDsNoon', 'الأعداد النسبية ن', ['نسبية', 'rationals', 'ℚ']),
  numberSet('arReals', '\\arDsHah', 'الأعداد الحقيقية ح', ['حقيقية', 'reals', 'ℝ']),
  numberSet(
    'arComplex',
    '\\mathord{\\htmlClass{sw-sym sw-font-arabicmath}{\\textbf{ك}}}',
    'الأعداد المركّبة ك',
    ['مركبة', 'عقدية', 'complex', 'ℂ'],
  ),
];
