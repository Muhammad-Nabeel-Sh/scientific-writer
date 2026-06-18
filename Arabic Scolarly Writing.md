1. Typography & Rendering (foundational)
- Kashida (تطويل / التمديد) — automatic justification via horizontal letter-stretching (the only proper way to justify Arabic; word-spacing looks wrong)
- Arabic-Indic digit choice — per-document toggle between Eastern (٠١٢٣) and Western (0123) numerals, with per-context granularity (body text vs. equation numbers)
- Ligature control — fine-grained font-variant support for common Arabic ligatures (lam-alif, etc.)
- Tashkeel-aware rendering — respect diacritic (harakat) placement without collision, at any font size
- Variable font support — weight/width axes for Arabic typefaces (e.g., Amiri VF, Noto Naskh Arabic VF)
2. Classical Arabic Book Layouts (high-impact differentiator)
- Matn–Sharḥ–Ḥāshiyah (متن–شرح–حاشية) — three-column/three-tier layout: core text (matn) in the center or top, commentary (sharḥ) in the second tier, marginal gloss (ḥāshiyah) on the outer margins. This is the standard layout for 90% of classical Islamic books.
- Taʿlīqāt / Hawāmish (تعليقات / هوامش) — proper margin notes (distinct from footnotes) pinned to line numbers or symbols, rendered in the side margin
- Interlinear gloss — annotations squeezed between lines of the base text (common in Qurʾān tafsīr and grammatical works)
- Page-as-canvas model — the preview pane should eventually support a paged view (not infinite scroll) so that matn/sharch/margin relationships are spatially preserved
3. Citations & Bibliography (Arabic-specific)
- Arabic CSL styles — full support for Arabic citation-format strings ("ص"، "جـ"، "المجلد"، "الطبعة")
- Islamic manuscript citation format — standard siglum system for mss. (library sigla + shelfmark + folio + side): e.g., "دار الكتب ١٢٣ ورقة ٥أ"
- Ṭabaqāt / biographical citation — auto-formatting for the classical biographical dictionary citation pattern (name → generation → death year → page)
- Bidirectional citations — Arabic citations inside English text (and vice versa) with correct pronoun ordering
4. Scholarly Writing Workflows
- Tafsīr mode — a split-panel writing mode where the primary text stays locked on one side and commentary is written on the other, with automatic back-linking
- Takhrij al-Ḥadīth (تخريج الحديث) — tooling to format hadith citations (e.g., "[رواه البخاري (١٢٣)" → auto-links to a hadith database or bibliography entry)
- Tashkeel-aware search — search that treats ḥarakāt as optional (entering "كتب" matches "كَتْبَ", "كُتُبٍ", etc.)
- Arabic word count — distinguish words, characters, and letters (ḥurūf) separately, since Arabic word counting conventions differ from Latin
5. Assisted Writing & AI (force multiplier)
- Auto-tashkeel (تشكيل آلي) — restore diacritics to undiacritized text (e.g., with a local or API-based model like Mishkal / Farasa)
- Tafqīt (تفقيط) — convert numbers to Arabic words ("٣٤٢" → "ثلاثمائة واثنان وأربعون") for legal/monetary contexts
- Arabic spellchecker with Sarf-aware correction — not just dictionary-based but morphological (root + pattern = "صرف") so it catches broken plurals and derivational errors
- Arabic grammar checker — iʿrāb-aware (إعراب) that detects agreement errors in gender, number, case
- Morphological analyzer (تحليل صرفي) — on hover, show root + pattern + grammatical analysis of any word
6. Export & Publishing
- PDF with full Arabic justification — kashida-based justification, proper ḥarakāt stacking, run-in headings
- EPUB with RTL-first CSS — not just dir="rtl" but proper -epub-writing-mode, page-progression-direction, and spread handling
- LaTeX export — targeting arabxetex / polyglossia with XeLaTeX engine, not pdfLaTeX
- HTML excerpt with embedded RTL — Sharable snippet format that preserves direction, fonts, and diacritics
- Print-ready book export — with running headers in Arabic ("الفصل الأول / الباب الثاني"), proper folio placement (left-page top-left, right-page top-left in RTL books)
7. Content Organization
- Automatic Table of Contents with Arabic numeral page numbers
- Index generation — collect Arabic terms with their page references, sort by alphabetic order (أ, ب, ت, ث, ...)
- List-of-Figures / List-of-Tables using Arabic labels ("شكل ١", "جدول ٣")
- Section numbering in Arabic (الفصل الأول → المبحث الأول → المطلب الأول → الفرع الأول)
8. Collaboration & Cross-reference
- Cross-reference with Arabic labels — [ref:theorem:1] = "انظر: نظرية ١" (already partially done)
- Annotations / comments that render in the margin (like medieval ḥawāshī) rather than inline bubbles
- Collaborative editing with RTL-aware diff highlighting (word-level, not character-level, since Arabic letter joining breaks on character boundaries)
- Version comparison that understands Arabic script: visual diffs should show broken ligatures correctly
9. Metadata & Special Content
- Islamic calendar conversion — date field that accepts both Hijri (هـ) and Gregorian, with auto-conversion
- Qurʾān citation tool — [q:1:2] → "الآية ٢ من سورة الفاتحة" with a popup showing the āyah
- Hadith citation tool — [hadith:bukhari:1] → formatted reference with source
- Poetry scansion (ʿArūḍ) — analysis of meter (baḥr) from a verse line
10. UI/UX polish
- RTL-aware resizable panels — the three-panel layout already has RTL, but resize handles should logically mirror in RTL mode
- Arabic keyboard shortcuts — Ctrl+Shift+T for tashkeel, Ctrl+Shift+F for footnote (already exists), Ctrl+Shift+Q for Qurʾān verse
- Font fallback chain configuration — user-settable list of Arabic fonts in priority order, per document
- Dark theme for Arabic fonts — not just background colour, but adjusted font weight on dark backgrounds (Arabic fonts often need bolder weights on dark)