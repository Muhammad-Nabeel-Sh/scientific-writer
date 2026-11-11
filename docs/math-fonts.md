# Math fonts — decision note (M6)

Date: 2026-11-11 · Status: **decided — Katib Math**, our own OFL font built on XITS Math.

## Question

Which font draws the math symbols KaTeX's own fonts lack, and lays out
right-to-left math? The main cases:
- **Arabic Mathematical Alphabetic Symbols** (U+1EE00–U+1EEFF, 143 characters),
  used by glyph symbols (`kind: 'glyph'`, class `sw-font-arabicmath`)
- **Arabic words inside formulas** (`\text{السرعة}`, function names جا، نها …)
- **Right-to-left math** (see [rtl-math-spike.md](rtl-math-spike.md)): needs a
  `MATH` table and `rtlm` mirrored forms

## Method

A small cmap/GSUB reader inspected the font files themselves, then the result was
checked in the running app. Per face it reports:
- coverage of U+1EE00–1EEFF, Arabic letters and ∑
- whether it has an OpenType `MATH` table
- whether it has the `rtlm` feature

Scanned: the bundled fonts, KaTeX's fonts, every system font on the development
machine (Windows 11, 649 faces), and the fonts added to `Fonts/`.

## Results

| Font | U+1EE00 block | Arabic | `MATH` | `rtlm` | Licence | Notes |
|---|---|---|---|---|---|---|
| **XITS Math 1.302** | **143 / 143** | no | **yes** | **yes** (152 glyphs, with size variants) | OFL | the only font with all three math properties |
| Amiri Regular | 143 / 143 | yes | no | yes (text) | OFL | best Arabic text shaping on hand |
| Noto Naskh Arabic | 0 | yes | no | yes | OFL | |
| Cambria Math (Windows) | 0 | no | yes | yes | proprietary, system only | not shippable; Windows only |
| KaTeX_* | 0 | no | no | no | MIT | why KaTeX cannot draw Arabic itself |
| Mazeri Arabic Math Symbol (1, 2) | 0 (glyphs in Private Use Area F020–F0FF) | – | no | no | **none stated** | rich Arabic notation, but symbol-encoded and with no licence, so it can't be shipped or modified (see below) |
| MO Bayannur | – | – | – | – | trial EULA | excluded |

## Decision: Katib Math

**Katib Math = XITS Math + Amiri's Arabic script**, built reproducibly by
[`fonts-src/katib-math/build.py`](../fonts-src/katib-math/build.py) under the OFL.
See the font's [README](../fonts-src/katib-math/README.md) and
[FONTLOG](../fonts-src/katib-math/FONTLOG.txt).

The build was verified on the font file:
- the `MATH` table is byte-for-byte XITS's, and XITS's glyph order is an exact prefix, so every math glyph reference still points to the same glyph
- all 42 Arabic letters, the marks, tatweel and all 143 math-alphabet characters are present
- `rtlm` is registered under DFLT/latn/math, with mirrored size variants and radical assemblies
- the Arabic shaping features `init`/`medi`/`fina`/`rlig`/`ccmp` sit under `arab`

Where it is used (`src/app.css`, section "Katib Math"):
1. **Arabic inside any KaTeX formula.** Extra `@font-face` rules for `KaTeX_Main`
   and `KaTeX_Math` (normal and italic) point to Katib Math with an Arabic-only
   `unicode-range`. KaTeX's fonts have no Arabic, so exactly those characters use
   it, and the italic face prevents fake-italic Arabic.
2. **Glyph symbols:** `.sw-font-arabicmath` → `'Katib Math', 'Amiri'`.
3. **Right-to-left MathML:** `font-family: 'Katib Math', math, serif`. Operators,
   radicals and Arabic all come from one font, so it **no longer depends on the
   OS math font**.
4. **Export (Phase 4):** `fonts-src/katib-math/dist/KatibMath-Regular.otf` with
   `unicode-math`.

Verified in the running app (Chromium), `docs/images/math/katib-math.png`:
- mirrored ∑ and √ in `$$[rtl]`, plus Arabic-Indic digits
- Arabic text and function names in LTR formulas drawn with Katib Math
- `document.fonts.check('30px "Katib Math"', 'سجا√∑')` is `true`

Earlier screenshots (Amiri-only and Cambria stacks) are kept in
`docs/images/math/` for comparison.

## Why not Mazeri

Mazeri's two symbol fonts have a valuable Arabic notation set: ready-made
جا جتا ظا ظتا قا قتا, نها and لو with a limit stroke, a mirrored ∑, and Arabic
math letters. But:
- **There is no licence or copyright statement.** Shipping the font, or a modified
  copy of it, needs the copyright holder's permission. "Minor improvements" would
  still be a derived work.
- **It is symbol-encoded** (Private Use Area), so its characters have no meaning
  outside the font. Copy-paste, search, LaTeX and Word export would carry
  meaningless codepoints.

Its *repertoire* (which symbols Arabic math needs) is still useful as a checklist
for what Katib Math should cover. Lists of notation aren't anyone's property, as
long as every glyph is drawn fresh or taken from an OFL source. If Mazeri's author
can be found and agrees to an OFL release, its shapes could be merged in later.

## Gaps / follow-up

- **Bold:** only Regular is built. XITS Math Bold lacks the Arabic math alphabet.
  A bold Katib Math would need Amiri Bold plus a decision on the alphabet.
- **Function-name forms:** نها/لو with a long limit stroke are not separate
  glyphs. Write them with tatweel (`نهــا`) or as `\operatorname*{…}`; a dedicated
  design is possible later.
- **Size:** the WOFF2 is 438 KiB, because Amiri's full Arabic shaping set is
  5924 glyphs. Acceptable for a desktop app. Subsetting Amiri's ornamental
  alternates (`ss0x`) would shrink it.
