# Math fonts — decision note (M6)

Date: 2026-11-11 · Status: **decided for now**; one follow-up once the network is available.

## Question

Which font draws math symbols that KaTeX's own fonts lack? The main case is the
**Arabic Mathematical Alphabetic Symbols** block (U+1EE00–U+1EEFF, 143 assigned
characters), used by glyph symbols (`kind: 'glyph'`, class `sw-font-arabicmath`).
A second question is which font lays out **right-to-left math** (see
[rtl-math-spike.md](rtl-math-spike.md)).

## Method

The font binaries were inspected directly. A small cmap/GSUB reader parses TTF,
OTF, TTC and WOFF2 (`cmap-scan.cjs`, kept outside the repo; it is easy to
recreate from this description). For each face it reports:
- how many U+1EE00–1EEFF codepoints it covers
- whether it covers Arabic letters (ا ل), Latin math alphanumerics (U+1D400) and ∑
- whether it has an OpenType `MATH` table
- whether it has the `rtlm` (right-to-left mirrored forms) GSUB feature

It scanned the bundled fonts (`static/fonts`), KaTeX's fonts and every system
font on the development machine (Windows 11, 649 faces).

The network was down during the evaluation, so candidates that would need a
download (XITS Math, STIX Two Math, Noto Sans Math) could **not** be measured.

## Results

| Font | U+1EE00 block | Arabic | `MATH` table | `rtlm` | Notes |
|---|---|---|---|---|---|
| **Amiri** (bundled, `arabic` subsets, regular + bold) | **143 / 143** | yes | no | no | already OFL-bundled; our `@font-face` `unicode-range` already routes U+1EE00… to these files |
| Amiri (latin/other subsets) | 0 | – | no | no | |
| Noto Sans Arabic (bundled) | 0 | yes | no | one subset | |
| KaTeX_* (bundled by KaTeX) | 0 | no | no | no | why KaTeX cannot draw these glyphs itself |
| Cambria Math (Windows system, `cambria.ttc#1`) | 0 | no | **yes** | **yes** | the browser's `math` generic family on Windows |
| UULA Sans (user-installed) | 16 / 143 | yes | no | no | not usable |

Browser check: `document.fonts.check('16px Amiri', '\u{1EE00}')` is `true` in
the running app, and a glyph symbol renders with Amiri
(`docs/images/math/glyph-and-marker.png`).

## Decision

1. **Glyph symbols use Amiri.** CSS (`src/app.css`):
   `.katex .sw-font-arabicmath, .katex .sw-font-arabicmath * { font-family: 'Amiri', 'Noto Sans Arabic', serif }`.
   It covers the whole block, is already bundled and needs no extra download.
   M5 should generate glyph symbols with `font: 'arabicmath'`.
2. **RTL MathML** uses `font-family: math, 'Cambria Math', 'Amiri', serif`.
   The system math font comes **first**, for radicals, stretchy operators and
   `rtlm`. Arabic letters fall through to Amiri. With Amiri first, the radical
   in `\sqrt{}` is not drawn at all (`rtl-amiri-first.jpg`).

## Gaps / follow-up

- **No font on hand has both a `MATH` table and the Arabic math alphabet.** RTL
  math therefore depends on the OS math font: Cambria Math on Windows; macOS
  and Linux are unverified. **Follow-up:** when the network is available, run
  the same scan on **XITS Math** (aliftype/xits), STIX Two Math and Noto Sans
  Math. If XITS Math has `MATH` + `rtlm` + U+1EE00, bundle it (OFL) and put it
  first in the RTL stack, so RTL math looks the same on every OS.
- Amiri is a text font, so Arabic-letter glyphs use text metrics (no italic
  correction or math kerning). That is acceptable for single letters.
- Glyph symbols in **LTR** KaTeX output depend only on Amiri, which is bundled,
  so they are cross-platform.
