/**
 * Arabic function names (Mashriq school notation).
 *
 * Seed entries only — the full list (ظا، ظتا، قا، قتا، لو، لط، مجـ, inverse
 * forms …) is task M4; follow CRITIQUE_AND_PLAN.md Appendix 1 for names.
 * Operators that take limits underneath use \operatorname* (starred).
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

export const ARABIC_FUNCTIONS: MathSymbol[] = [
  fn('jaa', 'جا', 'جيب الزاوية', ['جا', 'جيب', 'sin', 'sine']),
  fn('jataa', 'جتا', 'جيب تمام الزاوية', ['جتا', 'جيب تمام', 'cos', 'cosine']),
  fn('nihaya', 'نها', 'النهاية', ['نها', 'نهاية', 'lim', 'limit'], true),
];
