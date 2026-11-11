# Katib Math (كاتب)

An OpenType math font for Arabic scientific writing. It's the font الكاتب العلمي
uses for every Arabic math symbol, in the preview (KaTeX and MathML) and in export
(XeLaTeX/LuaLaTeX `unicode-math`, Word).

**Katib Math = [XITS Math](https://github.com/aliftype/xits) 1.302 + the Arabic script of [Amiri](https://github.com/aliftype/amiri).**

| From XITS Math | From Amiri |
|---|---|
| OpenType `MATH` table (radicals, fractions, stretchy delimiters, limits) | Arabic letters U+0600–06FF, Supplement, Extended-A |
| `rtlm` right-to-left mirrored forms (∑, √, ∫ … with all size variants) | Presentation forms A/B |
| **Arabic Mathematical Alphabetic Symbols** U+1EE00–1EEFF (all 143) | Shaping: `init` `medi` `fina` `rlig` `ccmp` + mark positioning (GPOS) |
| Arabic-Indic digits (math-designed, kept over Amiri's) | Tatweel, ZWJ/ZWNJ, LRM/RLM |
| Latin, Greek and the full math symbol repertoire | |

## Licence

SIL Open Font License 1.1. See [OFL.txt](OFL.txt): it lists the copyright of both
sources and of the Katib Math modifications. The sources' Reserved Font Names
("STIX Fonts", "TM Math") are not used.

## Building

```bash
python -m venv fonts-src/.venv
fonts-src/.venv/Scripts/python -m pip install -r fonts-src/katib-math/requirements.txt
fonts-src/.venv/Scripts/python fonts-src/katib-math/build.py
```

The build reads `upstream/` (unmodified copies of the source fonts and their
licences) and writes:
- `dist/KatibMath-Regular.otf`: the committed release for LaTeX and Word
- `dist/KatibMath-Regular.woff2`: the committed web font
- `static/fonts/katib-math/KatibMath-Regular.woff2` + `OFL.txt`: what the app loads

The build is deterministic for given inputs. Re-run it after changing `build.py`
or updating `upstream/`.

## Using it

- App CSS: `src/app.css`, section "Katib Math". Arabic inside any KaTeX formula,
  glyph symbols (`.sw-font-arabicmath`) and right-to-left MathML all use it.
- LaTeX (Phase 4): `\usepackage{unicode-math}` and
  `\setmathfont{KatibMath-Regular.otf}`.

## Changes from the sources

See [FONTLOG.txt](FONTLOG.txt).
