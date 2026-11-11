/**
 * Built-in symbol sets. Add a new set by exporting an array of MathSymbol
 * from a file in this folder and listing it here.
 */
import type { MathSymbol } from '../registry';
import { ARABIC_ALPHABET } from './arabic-alphabet';
import { ARABIC_FUNCTIONS } from './arabic-functions';

export const BUILTIN_SYMBOL_SETS: MathSymbol[][] = [ARABIC_FUNCTIONS, ARABIC_ALPHABET];

export { arabicLetterVariant, type ArabicLetterVariant } from './arabic-alphabet';
