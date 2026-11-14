import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { getSymbols, getSymbolSource } from '$lib/math';

describe('CTAN package katibmath', () => {
  const sty = readFileSync('ctan/katibmath/katibmath.sty', 'utf8');

  it('defines every built-in symbol (run `npm run ctan:build` after adding symbols)', () => {
    const missing = getSymbols()
      .filter((s) => getSymbolSource(s.name) === 'builtin')
      .filter((s) => !sty.includes(`\\DeclareRobustCommand{\\${s.name}}`))
      .map((s) => s.name);
    expect(missing).toEqual([]);
  });

  it('uses only its own helpers, not the app exporter ones', () => {
    expect(sty).not.toMatch(/\\sw(mirror|mathglyphs)\b|Path=\.\//);
  });
});
