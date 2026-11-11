/**
 * Arabic function names (Mashriq school notation), as KaTeX macros.
 * Names follow CRITIQUE_AND_PLAN.md Appendix 1. Operators that take limits
 * underneath (نها، مجـ) use \operatorname* (starred).
 */
import type { MathSymbol } from '../registry';

function fn(name: string, ar: string, labelAr: string, keywords: string[], limits = false): MathSymbol {
  const op = limits ? '\\operatorname*' : '\\operatorname';
  return {
    name,
    category: 'arabic-function',
    labelAr,
    keywords,
    katex: { kind: 'macro', body: `${op}{\\text{${ar}}}` },
    latex: { body: `${op}{\\textarabic{${ar}}}` },
  };
}

/** Inverse function: جا^{-1} (written with a superscript -1, as in Arabic textbooks). */
function inv(name: string, ar: string, labelAr: string, keywords: string[]): MathSymbol {
  return {
    name,
    category: 'arabic-function',
    labelAr,
    keywords,
    katex: { kind: 'macro', body: `\\operatorname{\\text{${ar}}}^{-1}` },
    latex: { body: `\\operatorname{\\textarabic{${ar}}}^{-1}` },
  };
}

export const ARABIC_FUNCTIONS: MathSymbol[] = [
  // trigonometric
  fn('jaa', 'جا', 'جيب الزاوية', ['جا', 'جيب', 'sin', 'sine']),
  fn('jataa', 'جتا', 'جيب تمام الزاوية', ['جتا', 'جيب تمام', 'cos', 'cosine']),
  fn('dhaa', 'ظا', 'ظل الزاوية', ['ظا', 'ظل', 'tan', 'tangent']),
  fn('dhataa', 'ظتا', 'ظل تمام الزاوية', ['ظتا', 'ظل تمام', 'cot', 'cotangent']),
  fn('qaa', 'قا', 'قاطع الزاوية', ['قا', 'قاطع', 'sec', 'secant']),
  fn('qataa', 'قتا', 'قاطع تمام الزاوية', ['قتا', 'قاطع تمام', 'csc', 'cosecant']),
  // inverse trigonometric
  inv('jaainv', 'جا', 'معكوس الجيب', ['جا-1', 'قوس الجيب', 'arcsin', 'inverse sine']),
  inv('jataainv', 'جتا', 'معكوس جيب التمام', ['جتا-1', 'arccos', 'inverse cosine']),
  inv('dhaainv', 'ظا', 'معكوس الظل', ['ظا-1', 'arctan', 'inverse tangent']),
  // hyperbolic
  fn('jaaz', 'جاز', 'الجيب الزائدي', ['جاز', 'زائدي', 'sinh', 'hyperbolic sine']),
  fn('jataaz', 'جتاز', 'جيب التمام الزائدي', ['جتاز', 'زائدي', 'cosh', 'hyperbolic cosine']),
  fn('dhaaz', 'ظاز', 'الظل الزائدي', ['ظاز', 'زائدي', 'tanh', 'hyperbolic tangent']),
  // logarithms
  fn('lugh', 'لو', 'اللوغاريتم', ['لو', 'لوغاريتم', 'log', 'logarithm']),
  fn('lugt', 'لط', 'اللوغاريتم الطبيعي', ['لط', 'طبيعي', 'ln', 'natural log']),
  // operators with limits
  fn('nihaya', 'نها', 'النهاية', ['نها', 'نهاية', 'lim', 'limit'], true),
  fn('majmu', 'مجـ', 'المجموع', ['مجـ', 'مجموع', 'sum'], true),
];
