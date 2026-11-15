/**
 * First-strong-character direction detection (the rule behind `dir="auto"`).
 *
 * Digits, punctuation, whitespace and combining marks are not strong; the first
 * letter decides. `ltr` is the fallback when there is no strong character.
 */
export type Direction = 'rtl' | 'ltr';

const RTL_SCRIPT =
  /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Samaritan}\p{Script=Mandaic}]/u;
const LTR_SCRIPT =
  /[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Armenian}\p{Script=Georgian}\p{Script=Devanagari}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const LETTER = /\p{L}/u;

export function detectDir(text: string): Direction {
  for (const ch of text) {
    if (!LETTER.test(ch)) continue;
    if (RTL_SCRIPT.test(ch)) return 'rtl';
    if (LTR_SCRIPT.test(ch)) return 'ltr';
  }
  return 'ltr';
}
