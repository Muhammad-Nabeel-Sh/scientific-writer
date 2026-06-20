# Arabic Scholarly Writing — Feature Status

> Status: [x] implemented  [~] partial  [ ] not yet implemented

---

## 1. Typography & Rendering (foundational)

- [x] **Kashida (تطويل / التمديد)** — automatic justification via `src/lib/kashida.ts`, applies tatweel characters in preview. Toggle via `kashidaConfig` store.
- [x] **Arabic-Indic digit choice** — `convertArabicDigits()` in `markdown.ts` with `digitStyle` store (auto/eastern/western), per-context protection (skips code, math, URLs, citations).
- [x] **Ligature control** — `ligatureSettings` store (standard/required/discretionary) applied as `font-feature-settings` on preview div.
- [~] **Tashkeel-aware rendering** — DiacriticDialog (manual palette) exists; automatic collision avoidance not yet implemented.
- [x] **Variable font support** — `fontSettings` store exposes weight (`wght`), optical size (`opsz`), width (`wdth`/`HEXP`) axes. Applied as `font-variation-settings`.

## 2. Classical Arabic Book Layouts (high-impact differentiator)

- [~] **Matn–Sharḥ–Ḥāshiyah (متن–شرح–حاشية)** — AST node types exist (`matn`, `sharh`, `hashiyah` in `publishing/ast.ts`); `markdown-classical.ts` has interlinear gloss rendering; paged three-tier layout not yet implemented.
- [ ] **Taʿlīqāt / Hawāmish (تعليقات / هوامش)** — not yet implemented (footnotes exist but margin notes do not).
- [x] **Interlinear gloss** — `renderInterlinearGloss()` in `markdown-classical.ts` handles annotation lines between base text.
- [ ] **Page-as-canvas model** — preview uses infinite scroll; paged view not implemented (future).

## 3. Citations & Bibliography (Arabic-specific)

- [x] **Arabic CSL styles** — `citation-arabic.ts` provides Arabic strings (ص، جـ، ع، ط, etc.) and formatting.
- [x] **Islamic manuscript citation format** — `@ms:key` prefix triggers manuscript formatting: `{siglum} {shelfmark}، ورقة {folio}{side}`.
- [x] **Ṭabaqāt / biographical citation** — `@tab:key` prefix triggers Ṭabaqāt formatting: `{author}، الطبقة {N}، ت {death}، ص {page}`.
- [~] **Bidirectional citations** — Arabic citations inside English text use correct Arabic ordinals; full bidi pronoun ordering not yet tested extensively.

## 4. Scholarly Writing Workflows

- [ ] **Tafsīr mode** — split-panel writing with locked primary text not yet implemented.
- [~] **Takhrij al-Ḥadīth (تخريج الحديث)** — hadith dialog (search + insert) exists; auto-formatting of full takhrij chains not implemented.
- [x] **Tashkeel-aware search** — `normalizeArabic()` in `search.ts` strips diacritics and normalizes alif/ya/ta/wau variants; keyword search is diacritic-insensitive.
- [~] **Arabic word count** — `Stats.svelte` shows character/word count; Arabic-specific ḥurūf counting not fully implemented.

## 5. Assisted Writing & AI (force multiplier)

- [ ] **Auto-tashkeel (تشكيل آلي)** — DiacriticDialog provides manual palette; automatic AI/ML-based tashkeel not implemented.
- [x] **Tafqīt (تفقيط)** — `src/lib/tafqit.ts` converts numbers to Arabic words (supports integers, fractions, up to billions). Accessible via TafqitDialog toolbar button.
- [ ] **Arabic spellchecker with Sarf-aware correction** — not implemented.
- [ ] **Arabic grammar checker** — not implemented.
- [~] **Morphological analyzer (تحليل صرفي)** — DictionaryDialog provides root/word search across 11 lexicons; on-hover analysis not implemented.

## 6. Export & Publishing

- [ ] **PDF with full Arabic justification** — not yet implemented (no direct PDF exporter; LaTeX export can be compiled to PDF via XeLaTeX).
- [ ] **EPUB with RTL-first CSS** — not implemented.
- [x] **LaTeX export** — `LatexExporter` in `publishing/latex-exporter.ts` targets XeLaTeX+polyglossia for Arabic, pdfLaTeX for LTR.
- [~] **HTML excerpt with embedded RTL** — preview pipeline produces RTL HTML; standalone excerpt export not implemented.
- [~] **Print-ready book export** — Manuscript compiler (`publishing/manuscript.ts`) generates unified AST with front matter, TOC, LoF, LoT; no direct print-ready format yet.

## 7. Content Organization

- [x] **Automatic Table of Contents** — Manuscript compiler generates TOC with up to 3 heading levels.
- [ ] **Index generation** — not implemented.
- [x] **List-of-Figures / List-of-Tables** — Manuscript compiler auto-generates LoF/LoT from document figures/tables.
- [ ] **Section numbering in Arabic** — not implemented (الفصل الأول → المبحث الأول → etc.).

## 8. Collaboration & Cross-reference

- [x] **Cross-reference with Arabic labels** — `[ref:eq:label]` and `[ref:type:...]` syntax resolved in markdown pipeline; manuscript compiler preserves cross-refs across chapters.
- [ ] **Annotations / comments in margins (ḥawāshī)** — not implemented.
- [ ] **Collaborative editing with RTL-aware diff** — not implemented.
- [ ] **Version comparison with Arabic script awareness** — not implemented.

## 9. Metadata & Special Content

- [x] **Islamic calendar conversion** — `src/lib/hijri.ts` wraps `@umalqura/core`; DateDialog provides bidirectional Hijri↔Gregorian picker with 6 output formats.
- [x] **Qurʾān citation tool** — QuranDialog searches embedded `quran.json` (6236 verses), inserts formatted block quotes with surah:ayah references.
- [x] **Hadith citation tool** — HadithDialog lazy-loads 9-book hadith dataset via Rust IPC, fuzzy-search via fuse.js, inserts formatted quotes.
- [ ] **Poetry scansion (ʿArūḍ)** — poetry fence (`` ```poetry ``) renders verse layout; meter analysis not implemented.

## 10. UI/UX Polish

- [x] **RTL-aware resizable panels** — three-column layout with drag handles, RTL-aware by default.
- [x] **Arabic keyboard shortcuts** — Ctrl+Z/Y/S/B/I/T/L/Q/1-6; dedicated buttons for Quran, Hadith, poetry, citations, dictionary.
- [~] **Font fallback chain configuration** — `TypographySettings.svelte` allows font family/weight/size; per-document fallback chain not implemented.
- [~] **Dark theme for Arabic fonts** — dark theme exists; Arabic font weight adjustment on dark backgrounds not yet optimized.

---

**Legend**: [x] = fully implemented  [~] = partially implemented  [ ] = not yet implemented

High-Impact Features for Arabic Writers
Critical (core workflow)
1. Auto-tashkeel (automatic diacritization) — Manual diacritic palette exists, but restoring harakat automatically via a local model (Mishkal, Farasa, or ONNX) would save Arabic writers enormous time. Number one requested feature in this domain.
2. Morphological analyzer on hover — You have 11 lexicons in SQLite already. The natural next step is: hover over any Arabic word → show root + wazn (pattern) + i`rab + dictionary match. This is the killer feature no other Arabic writing app has.
3. Arabic spellchecker (sarf-aware) — Not just dictionary lookup, but root+pattern based. Catches broken plural errors, verbal noun derivations, and gender agreement. Dictionary backend already exists; just need a morphological engine.
Scholarly workflow (differentiator)
4. Margin notes (hawashi) — Separate from footnotes, rendered as floating notes in the side margin pinned to line numbers. This is the standard annotation format in 90% of classical Arabic books. Currently missing.
5. Tafsir mode — Split-panel: primary text locked on one side, commentary on the other, with automatic back-linking. Standard workflow for Quranic commentary and hadith explanation.
6. CSL-based citation formatting — Currently hardcoded. Integrating CSL would give access to hundreds of styles (including Arabic-specific ones like Majma` al-Lughah).
UX polish
7. `Arud (poetry meter analysis) — Poetry fence syntax exists but meter detection doesn't. Adding automatic bahr detection from a verse line would be a unique scholarly feature.
App Structure & Filesystem Enhancements
Interface
Enhancement	Why
Tabbed editing	One note at a time means losing scroll position when switching. Tabs would let you jump between notes.
Ctrl+P quick-open	SearchDialog exists but is buried in the toolbar. A Ctrl+P/Super+P palette (like VS Code) would make navigation instant.
Export progress & errors	Pandoc export runs silently. Users need progress bars and clear error messages when Pandoc isn't found or fails.
Filesystem
Enhancement	Why
Git integration	Notes are .md files — perfectly suited for version control. Adding init/commit/diff would give writers version history and branching for drafts.
File watcher	If the user or another tool modifies files outside the app, hierarchy.json becomes stale. Tauri's notify crate would auto-refresh.
Multi-workspace	One workspace = one project. Recent workspaces list + workspace switcher in the sidebar would let users work on multiple books/papers.
Asset manager	Images go to assets/ but there's no UI to browse, preview, or delete them. A gallery panel would prevent orphaned assets.
Import	Currently only reads its own workspace. Import from DOCX, .tex, or external .md files would reduce lock-in.
Auto-recovery	No crash recovery. Periodic backups of the current note to a .backup directory would prevent data loss.
Architecture
Enhancement	Why
Undo/redo for hierarchy	Currently only editor content. Renaming/deleting/moving notes is permanent.
Customizable shortcuts	Hardcoded in Editor.svelte. A keybindings store would let users remap them.