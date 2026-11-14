# CTAN package `katibmath`

`ctan/katibmath/` is the LaTeX package that makes the app's Arabic math
symbols available to any XeLaTeX/LuaLaTeX user, through CTAN (and from
there TeX Live and MiKTeX).

`katibmath.sty` and `katibmath-symbols.tex` are **generated** from the symbol
registry (`src/lib/math/symbols/`) by `scripts/build-ctan-package.ts`, with
the same LaTeX bodies as the app's export (`src/lib/math/to-latex.ts`). Do not
edit them by hand. `katibmath.tex` (manual) and `katibmath/README.md` are
hand-written.

## Release

1. Bump the version: `KATIBMATH_VERSION` (default in the script) and the
   `\date{Version …}` line in `katibmath/katibmath.tex`.
2. Regenerate and copy the font:

   ```bash
   npm run ctan:build
   ```

3. Compile the manual with XeLaTeX (twice) or Tectonic in `ctan/katibmath/`:

   ```bash
   tectonic -X compile katibmath.tex
   ```

   It must finish with no `Missing character` lines.
4. Zip the folder as `katibmath/…` into `ctan/dist/katibmath.zip`.
5. Upload at <https://ctan.org/upload>. Licences: **LPPL 1.3c** (code) and
   **OFL 1.1** (font). Topics: Arabic, maths, font (OpenType).

The upload itself is done by the maintainer; CTAN reviews new packages by hand.
