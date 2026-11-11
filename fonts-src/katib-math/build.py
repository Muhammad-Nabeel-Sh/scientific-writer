"""
Build Katib Math — an OFL math font for Arabic scientific writing.

Katib Math = XITS Math 1.302 (OpenType MATH table, right-to-left mirrored
forms, the Unicode Arabic Mathematical Alphabet U+1EE00–1EEFF)
           + the Arabic script of Amiri (letters, Arabic-Indic digits,
             punctuation and the full shaping: init/medi/fina/rlig/mark …).

So one font typesets right-to-left Arabic math — operators, radicals,
stretchy delimiters *and* the Arabic letters, words and function names
(جا، جتا، نها …) inside formulas — in the browser (MathML), in XeLaTeX /
LuaLaTeX (unicode-math) and in Word.

Both sources are under the SIL Open Font License 1.1; so is the result.
Reserved Font Names of the sources ("STIX Fonts", "TM Math") are not used.

Usage (from the repository root):
    python -m venv fonts-src/.venv
    fonts-src/.venv/Scripts/python -m pip install -r fonts-src/katib-math/requirements.txt
    fonts-src/.venv/Scripts/python fonts-src/katib-math/build.py

Outputs: fonts-src/katib-math/dist/KatibMath-Regular.{otf,woff2} (committed)
and the WOFF2 in static/fonts/katib-math/ (used by the app) unless --no-install.
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.merge import Merger, Options as MergeOptions
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.subset import Options as SubsetOptions, Subsetter
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
UPSTREAM = HERE / "upstream"
BUILD = HERE / "build"
DIST = HERE / "dist"
INSTALL_DIR = REPO / "static" / "fonts" / "katib-math"

FAMILY = "Katib Math"
PS_NAME = "KatibMath-Regular"
VERSION = 1.000
VERSION_STRING = "Version 1.000; Katib Math (XITS Math 1.302 + Amiri)"

XITS = UPSTREAM / "XITSMath-Regular.otf"
AMIRI = UPSTREAM / "Amiri-Regular.ttf"

# Arabic script ranges taken from Amiri. The Arabic Mathematical Alphabet
# (U+1EE00…) is NOT taken from Amiri: XITS Math has it, with math metrics.
ARABIC_RANGES = [
    (0x0600, 0x06FF),  # Arabic
    (0x0750, 0x077F),  # Arabic Supplement
    (0x08A0, 0x08FF),  # Arabic Extended-A
    (0xFB50, 0xFDFF),  # Presentation Forms-A
    (0xFE70, 0xFEFF),  # Presentation Forms-B
    (0x200C, 0x200F),  # ZWNJ, ZWJ, LRM, RLM
    (0x25CC, 0x25CC),  # dotted circle (for isolated marks)
]

MODIFICATIONS_COPYRIGHT = "Katib Math modifications Copyright (c) 2026, Muhammmad Nabeel."
OFL_DESCRIPTION = (
    "This Font Software is licensed under the SIL Open Font License, Version 1.1. "
    "This license is available with a FAQ at: https://openfontlicense.org"
)
OFL_URL = "https://openfontlicense.org"


def log(msg: str) -> None:
    print(f"[katib-math] {msg}", flush=True)


def arabic_codepoints(font: TTFont) -> list[int]:
    cmap = font.getBestCmap()
    return sorted(c for c in cmap if any(lo <= c <= hi for lo, hi in ARABIC_RANGES))


def subset_amiri(path: Path) -> TTFont:
    font = TTFont(path)
    unicodes = arabic_codepoints(font)
    opts = SubsetOptions()
    opts.layout_features = ["*"]  # keep every shaping feature
    opts.layout_scripts = ["arab", "DFLT"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.glyph_names = True
    opts.hinting = False  # TrueType hints are meaningless once converted to CFF
    opts.drop_tables += ["gasp", "prep", "fpgm", "cvt "]
    sub = Subsetter(opts)
    sub.populate(unicodes=unicodes)
    sub.subset(font)
    log(f"Amiri Arabic subset: {len(unicodes)} codepoints, {len(font.getGlyphOrder())} glyphs")
    return font


def ttf_to_cff(src: TTFont, out: Path) -> None:
    """Re-encode TrueType (quadratic) outlines as CFF (cubic) — an exact conversion."""
    glyph_order = src.getGlyphOrder()
    glyph_set = src.getGlyphSet()
    hmtx = src["hmtx"].metrics
    charstrings = {}
    for name in glyph_order:
        pen = T2CharStringPen(hmtx[name][0], glyph_set)
        glyph_set[name].draw(pen)
        charstrings[name] = pen.getCharString()

    fb = FontBuilder(src["head"].unitsPerEm, isTTF=False)
    fb.setupGlyphOrder(glyph_order)
    fb.setupCharacterMap(src.getBestCmap())
    fb.setupCFF(
        psName="AmiriArabicSubset",
        fontInfo={"FullName": "Amiri Arabic Subset", "FamilyName": "Amiri Arabic Subset"},
        charStringsDict=charstrings,
        privateDict={},
    )
    fb.setupHorizontalMetrics(dict(hmtx))
    hhea = src["hhea"]
    fb.setupHorizontalHeader(ascent=hhea.ascent, descent=hhea.descent)
    fb.setupNameTable({"familyName": "Amiri Arabic Subset", "styleName": "Regular"})
    fb.setupOS2()
    fb.setupPost()
    font = fb.font
    for tag in ("GDEF", "GSUB", "GPOS"):
        if tag in src:
            font[tag] = src[tag]
    font.save(out)
    log(f"converted Arabic subset to CFF: {out.name}")


def set_names(font: TTFont) -> None:
    name = font["name"]
    xits_copyright = name.getDebugName(0) or ""
    copyright_text = " ".join(
        p for p in (
            xits_copyright.strip(),
            "Arabic glyphs: Copyright 2010-2022 The Amiri Project Authors (https://github.com/aliftype/amiri).",
            MODIFICATIONS_COPYRIGHT,
        ) if p
    )
    records = {
        0: copyright_text,
        1: FAMILY,
        2: "Regular",
        3: f"{VERSION:.3f};KATIB;{PS_NAME}",
        4: f"{FAMILY} Regular",
        5: VERSION_STRING,
        6: PS_NAME,
        13: OFL_DESCRIPTION,
        14: OFL_URL,
        16: FAMILY,
        17: "Regular",
    }
    # Drop inherited names that would misidentify the font (XITS/STIX names, trademarks, URLs).
    name.names = [n for n in name.names if n.nameID not in (*records.keys(), 7, 8, 9, 10, 11, 12)]
    for name_id, text in records.items():
        name.setName(text, name_id, 3, 1, 0x409)  # Windows, Unicode BMP, en-US
        name.setName(text, name_id, 1, 0, 0)  # Mac, Roman, English
    font["head"].fontRevision = VERSION
    if "CFF " in font:
        cff = font["CFF "].cff
        cff.fontNames = [PS_NAME]
        top = cff.topDictIndex[0]
        top.FullName = f"{FAMILY} Regular"
        top.FamilyName = FAMILY
        top.Notice = MODIFICATIONS_COPYRIGHT + " Licensed under the SIL OFL 1.1."
        top.Copyright = ""


def fix_metrics(font: TTFont, amiri: TTFont) -> None:
    """Keep XITS line metrics for layout; widen the clipping box so tall Arabic
    marks are not clipped by GDI/Word (winAscent/winDescent)."""
    os2 = font["OS/2"]
    a_os2 = amiri["OS/2"]
    os2.usWinAscent = max(os2.usWinAscent, a_os2.usWinAscent)
    os2.usWinDescent = max(os2.usWinDescent, a_os2.usWinDescent)
    # Arabic code page / Unicode range bits so Word and the OS treat it as an Arabic font.
    os2.ulCodePageRange1 |= 1 << 6  # 1256 Arabic
    os2.ulUnicodeRange1 |= 1 << 13  # Arabic
    os2.ulUnicodeRange2 |= (1 << (63 - 32)) | (1 << (57 - 32))  # Arabic Pres. Forms-A (63), Non-plane 0 (57)
    os2.ulUnicodeRange3 |= 1 << (67 - 64)  # Arabic Presentation Forms-B
    os2.fsType = 0  # installable embedding, as the OFL intends


def build(install: bool) -> Path:
    BUILD.mkdir(exist_ok=True)
    amiri_cff = BUILD / "amiri-arabic-cff.otf"
    amiri_sub = subset_amiri(AMIRI)
    ttf_to_cff(amiri_sub, amiri_cff)

    # fontTools.merge cannot merge the MATH table, so merge a copy of XITS
    # without it and put the original back. XITS comes first, so its glyphs
    # keep their names and the table's glyph references stay valid.
    xits = TTFont(XITS)
    math_table = xits["MATH"]
    xits_nomath = BUILD / "xits-nomath.otf"
    stripped = TTFont(XITS)
    del stripped["MATH"]
    stripped.save(xits_nomath)

    log("merging XITS Math + Arabic subset (XITS first: its math digits win conflicts)")
    merger = Merger(options=MergeOptions(drop_tables=[]))
    merged = merger.merge([str(xits_nomath), str(amiri_cff)])
    merged["MATH"] = math_table
    log("restored MATH table from XITS Math")

    fix_metrics(merged, TTFont(AMIRI))
    set_names(merged)

    otf = BUILD / f"{PS_NAME}.otf"
    merged.save(otf)
    woff2 = BUILD / f"{PS_NAME}.woff2"
    web = TTFont(otf)
    web.flavor = "woff2"
    web.save(woff2)
    log(f"wrote {otf.relative_to(REPO)} ({otf.stat().st_size // 1024} KiB), {woff2.name} ({woff2.stat().st_size // 1024} KiB)")

    # dist/ is committed: OTF for LaTeX (unicode-math) and Word, WOFF2 for the web.
    DIST.mkdir(exist_ok=True)
    for f in (otf, woff2):
        shutil.copy2(f, DIST / f.name)
    shutil.copy2(HERE / "OFL.txt", DIST / "OFL.txt")

    if install:
        # The app only needs the web font.
        INSTALL_DIR.mkdir(parents=True, exist_ok=True)
        for stale in INSTALL_DIR.glob("*.otf"):
            stale.unlink()
        shutil.copy2(woff2, INSTALL_DIR / woff2.name)
        shutil.copy2(HERE / "OFL.txt", INSTALL_DIR / "OFL.txt")
        log(f"installed {woff2.name} into {INSTALL_DIR.relative_to(REPO)}")
    return otf


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--no-install", action="store_true", help="do not copy into static/fonts")
    args = ap.parse_args()
    build(install=not args.no_install)
    return 0


if __name__ == "__main__":
    sys.exit(main())
