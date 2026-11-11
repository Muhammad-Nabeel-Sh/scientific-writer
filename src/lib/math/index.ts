/**
 * Math entry point. Import from `$lib/math` (not the individual files) so the
 * built-in symbols are registered before anything renders.
 */
import { defineSymbols, getSymbolSource } from './registry';
import { BUILTIN_SYMBOL_SETS } from './symbols';

let builtinsLoaded = false;

/** Register the built-in symbol sets once. Rejections are programming errors and are logged. */
export function ensureBuiltinSymbols(): void {
  if (builtinsLoaded) return;
  builtinsLoaded = true;
  for (const set of BUILTIN_SYMBOL_SETS) {
    const fresh = set.filter((s) => getSymbolSource(s.name) === undefined);
    const rejected = defineSymbols(fresh, 'builtin');
    for (const [name, errors] of Object.entries(rejected)) {
      console.error(`[math] built-in symbol \\${name} rejected:`, errors);
    }
  }
}

ensureBuiltinSymbols();

export {
  renderMath,
  isKatexCommand,
  isolateArabicRuns,
  type MathIssue,
  type MathRenderOptions,
  type MathDir,
} from './katex-instance';
export * from './registry';
export * from './user-symbols';
export * from './arabic-gallery';
export * from './equation-snippet';
