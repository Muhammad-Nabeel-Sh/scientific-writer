/**
 * Built-in symbol sets. Add a new set by exporting an array of MathSymbol
 * from a file in this folder and listing it here.
 */
import type { MathSymbol } from '../registry';
import { ARABIC_ALPHABET } from './arabic-alphabet';
import { ARABIC_FUNCTIONS } from './arabic-functions';
import { ARABIC_SIGNS, MIRRORED_OPERATORS, NUMBER_SETS } from './arabic-operators';

export const BUILTIN_SYMBOL_SETS: MathSymbol[][] = [
  ARABIC_FUNCTIONS,
  ARABIC_ALPHABET,
  MIRRORED_OPERATORS,
  ARABIC_SIGNS,
  NUMBER_SETS,
];

export { arabicLetterVariant, type ArabicLetterVariant } from './arabic-alphabet';
export { ARABIC_SIGNS, MIRRORED_OPERATORS, NUMBER_SETS } from './arabic-operators';
