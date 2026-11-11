/**
 * Per-workspace custom symbols: `{workspace}/math-symbols.json`, so a book
 * carries its own notation with it.
 *
 *   { "version": 1, "symbols": [ MathSymbol, … ] }
 */
import { clearUserSymbols, defineSymbols, validateSymbol, type MathSymbol } from './registry';

export const USER_SYMBOLS_FILE = 'math-symbols.json';
export const USER_SYMBOLS_VERSION = 1;

export interface UserSymbolsFile {
  version: number;
  symbols: MathSymbol[];
}

export interface ParseUserSymbolsResult {
  symbols: MathSymbol[];
  /** Human-readable (Arabic) problems; invalid entries are skipped, valid ones kept. */
  errors: string[];
}

export function parseUserSymbolsFile(text: string): ParseUserSymbolsResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { symbols: [], errors: [`${USER_SYMBOLS_FILE}: JSON غير صالح (${e instanceof Error ? e.message : e})`] };
  }
  const file = data as Partial<UserSymbolsFile> | null;
  if (!file || typeof file !== 'object' || !Array.isArray(file.symbols)) {
    return { symbols: [], errors: [`${USER_SYMBOLS_FILE}: يجب أن يحتوي على قائمة "symbols"`] };
  }
  if (file.version !== USER_SYMBOLS_VERSION) {
    return { symbols: [], errors: [`${USER_SYMBOLS_FILE}: إصدار غير مدعوم ${String(file.version)}`] };
  }
  const symbols: MathSymbol[] = [];
  const errors: string[] = [];
  file.symbols.forEach((s, i) => {
    const problems = validateSymbol(s);
    if (problems.length) errors.push(`الرمز رقم ${i + 1} (${(s as MathSymbol)?.name ?? '?'}): ${problems.join('؛ ')}`);
    else symbols.push(s);
  });
  return { symbols, errors };
}

export function serializeUserSymbols(symbols: MathSymbol[]): string {
  const file: UserSymbolsFile = { version: USER_SYMBOLS_VERSION, symbols };
  return JSON.stringify(file, null, 2) + '\n';
}

/**
 * Replace the registry's user symbols with the contents of a workspace file.
 * `text` is null when the workspace has no file. Returns problems to show.
 */
export function applyUserSymbols(text: string | null): string[] {
  clearUserSymbols();
  if (text == null || !text.trim()) return [];
  const { symbols, errors } = parseUserSymbolsFile(text);
  const rejected = defineSymbols(symbols, 'user');
  for (const [name, problems] of Object.entries(rejected)) errors.push(`\\${name}: ${problems.join('؛ ')}`);
  return errors;
}
