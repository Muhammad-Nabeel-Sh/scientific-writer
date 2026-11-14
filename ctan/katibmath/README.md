# katibmath — Arabic mathematical notation for XeLaTeX and LuaLaTeX

`katibmath` provides the Arabic mathematical notation of Arabic school and
university texts:

- Arabic function names and limits: `\jaa` (جا), `\nihaya` (نها), `\lu` (لو) …
- the Arabic Mathematical Alphabetic Symbols of Unicode (U+1EE00–1EEFF):
  initial, tailed, stretched, looped and double-struck letters
- mirrored operators for Arabic-style formulas: `\rsum`, `\rint`, `\riint`,
  `\rsqrt`, `\rroot`, `\rpartial`, `\rpropto` …
- the Arabic-script math signs ؆ ؇ ؈ ٪ ؉ ؊ and Arabic number sets
  (`\arNaturals`, `\arReals`, `\arComplex` …)

It ships **Katib Math**, an OpenType math font made from XITS Math and the
Arabic script of Amiri.

The commands are generated from the symbol registry of the Arabic writing app
الكاتب العلمي (Scientific Writer), so documents it exports compile unchanged.

## Usage

```latex
\usepackage{katibmath}              % Katib Math becomes the math font
\usepackage[nomathfont]{katibmath}  % keep your own math font
```

Requires XeLaTeX or LuaLaTeX. See `katibmath.pdf` for the full symbol list.

## Files

| File                                     |               |
| ---------------------------------------- | ------------- |
| `katibmath.sty`                          | the package   |
| `katibmath.tex`, `katibmath-symbols.tex` | manual source |
| `katibmath.pdf`                          | manual        |
| `KatibMath-Regular.otf`                  | the font      |
| `OFL.txt`                                | font licence  |

## Licence

Package code: LaTeX Project Public License 1.3c or later.
Font: SIL Open Font License 1.1 (see `OFL.txt`).

Copyright © 2026 Muhammad Nabeel Shaesha
