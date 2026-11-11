/**
 * Loads and saves the workspace's custom math symbols
 * (`{workspace}/math-symbols.json`) into the symbol registry.
 * Kept out of `$lib/math` so that module stays free of Tauri calls.
 */
import { readMathSymbolsFile, writeMathSymbolsFile } from './fs';
import { applyUserSymbols, serializeUserSymbols, type MathSymbol } from './math';

/** Re-read math-symbols.json. Returns problems to show the user (empty = fine). */
export async function reloadWorkspaceSymbols(): Promise<string[]> {
  try {
    return applyUserSymbols(await readMathSymbolsFile());
  } catch (e) {
    applyUserSymbols(null);
    return [`تعذّرت قراءة math-symbols.json: ${e instanceof Error ? e.message : e}`];
  }
}

/** Write the user's symbols and load them. Returns problems from the reload. */
export async function saveWorkspaceSymbols(symbols: MathSymbol[]): Promise<string[]> {
  await writeMathSymbolsFile(serializeUserSymbols(symbols));
  return reloadWorkspaceSymbols();
}
