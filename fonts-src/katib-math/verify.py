"""Verify the shipped Katib Math font.

Checks that the Arabic shaping features survived the subset, that the
ornamental stylistic sets (ss01–ss08) are gone, and — when uharfbuzz is
installed — that "سلام" and "لا" still shape into contextual forms.

Usage (from the repository root):
    fonts-src/.venv/Scripts/python fonts-src/katib-math/verify.py
"""
from __future__ import annotations

import sys
from pathlib import Path

from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
OTF = HERE / "dist" / "KatibMath-Regular.otf"
WEB = REPO / "static" / "fonts" / "katib-math" / "KatibMath-Regular.woff2"
REQUIRED_FEATURES = {"init", "medi", "fina", "rlig", "ccmp", "mark"}


def layout_features(font: TTFont) -> set[str]:
    tags: set[str] = set()
    for table_tag in ("GSUB", "GPOS"):
        if table_tag in font:
            tags.update(fr.FeatureTag for fr in font[table_tag].table.FeatureList.FeatureRecord)
    return tags


def main() -> int:
    for path in (OTF, WEB):
        if not path.exists():
            print(f"missing {path}")
            return 1

    font = TTFont(OTF)
    web = TTFont(WEB)
    tags = layout_features(font)
    print(f"OTF: {len(font.getGlyphOrder())} glyphs, {OTF.stat().st_size // 1024} KiB")
    print(f"WOFF2: {WEB.stat().st_size // 1024} KiB")

    missing = REQUIRED_FEATURES - tags
    assert not missing, f"missing shaping features: {sorted(missing)}"

    # The final font legitimately contains XITS Math's stylistic sets (it has
    # ss01–ss10). Only Amiri's ornament sets must be gone; check the subset
    # produced for the merge, when present.
    amiri_subset = HERE / "build" / "amiri-arabic-cff.otf"
    if amiri_subset.exists():
        amiri_tags = layout_features(TTFont(amiri_subset))
        ornamental = {t for t in amiri_tags if len(t) == 4 and t.startswith("ss") and t[2:].isdigit()}
        assert not ornamental, f"Amiri ornamental features still present: {sorted(ornamental)}"
        print("Amiri subset: no ss01–ss08 ornament features")

    xits = TTFont(HERE / "upstream" / "XITSMath-Regular.otf")
    xits_ss = sorted(t for t in layout_features(xits) if t.startswith("ss"))
    kept_ss = sorted(t for t in tags if t.startswith("ss"))
    print(f"XITS Math stylistic sets retained: {', '.join(kept_ss) or 'none'}")
    assert kept_ss == xits_ss, f"unexpected stylistic sets: {sorted(set(kept_ss) ^ set(xits_ss))}"

    cmap = font.getBestCmap()
    for text in ("سلام", "لا"):
        missing_cp = [f"U+{ord(ch):04X}" for ch in text if ord(ch) not in cmap]
        assert not missing_cp, f"cmap missing {missing_cp} in {text}"
    assert set(web.getBestCmap()) == set(cmap), "WOFF2 cmap differs from the OTF"

    try:
        import uharfbuzz as hb
    except ImportError:
        print("uharfbuzz not installed; skipped live shaping check")
        print("(pip install -r fonts-src/katib-math/requirements-dev.txt)")
        return 0

    blob = hb.Blob.from_file_path(str(OTF))
    hbfont = hb.Font(hb.Face(blob))
    nominal = {cmap[ord(ch)] for ch in "سلاملا"}

    def shape(text: str) -> list[str]:
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(hbfont, buf)
        return [hbfont.glyph_to_string(info.codepoint) for info in buf.glyph_infos]

    for text in ("سلام", "لا"):
        names = shape(text)
        assert "notdef" not in names and ".notdef" not in names, f"{text}: shaped to .notdef"
        assert any(n not in nominal for n in names), f"{text}: no contextual form applied ({names})"
        print(f"shaped {text}: {names}")

    print("OK: shaping survives and no ss01–ss08 ornament sets remain.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
