/**
 * Further Arabic notation requested for M17 (2026-11-11):
 * GCD/LCM abbreviations, determinant name, modulo, prefix factorial.
 *
 * The interval and set-builder forms are templates in arabic-gallery.ts
 * because they are shapes to fill in, not single symbols.
 */
import type { MathSymbol } from '../registry';

function named(
  name: string,
  ar: string,
  labelAr: string,
  keywords: string[],
): MathSymbol {
  return {
    name,
    category: 'operator',
    labelAr,
    keywords,
    katex: { kind: 'macro', body: `\\operatorname{\\text{${ar}}}` },
    latex: { body: `\\operatorname{\\textarabic{${ar}}}` },
  };
}

export const ARABIC_NOTATION: MathSymbol[] = [
  named('arGcd', 'ق.م.أ', 'القاسم المشترك الأكبر (ق.م.أ)', ['ق.م.أ', 'قاسم مشترك', 'gcd', 'greatest common divisor']),
  named('arLcm', 'م.م.أ', 'المضاعف المشترك الأصغر (م.م.أ)', ['م.م.أ', 'مضاعف مشترك', 'lcm', 'least common multiple']),
  named('arDet', 'محدد', 'المحدد', ['محدد', 'determinant', 'det']),
  {
    name: 'arMod',
    category: 'relation',
    labelAr: 'باقي القسمة (مودولو)',
    keywords: ['باقي القسمة', 'باقي', 'مودولو', 'mod', 'modulo'],
    katex: { kind: 'macro', body: '\\mathrel{\\text{باقي القسمة}}' },
    latex: { body: '\\mathrel{\\textarabic{باقي القسمة}}' },
  },
  {
    name: 'arFact',
    category: 'operator',
    labelAr: 'المضروب (علامة التعجب قبل العدد)',
    keywords: ['مضروب', 'عاملي', 'علامة تعجب', 'factorial'],
    arity: 1,
    katex: { kind: 'macro', body: '\\mathord{!}#1' },
    latex: { body: '\\mathord{!}#1' },
  },
];
