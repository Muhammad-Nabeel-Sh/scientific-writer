# Phase I Summary — Arabic Scientific Writer

## Stack
- **Desktop shell**: Tauri v2 (Rust backend)
- **Frontend**: SvelteKit 2 + Vite 6 (SPA, SSR disabled)
- **Language**: TypeScript (frontend), Rust (backend)
- **Markdown**: markdown-it v14 + markdown-it-katex + highlight.js
- **Search**: Fuse.js (for Quran and Hadith)
- **Font**: Amiri (Google Fonts) for Arabic text

---

## Core Features

### Three-Panel Layout
- **HierarchyTree** (right panel, RTL) — file browser with folder/note tree
- **Editor** (center) — markdown textarea with full toolbar
- **Preview** (right) — rendered HTML with light/white background
- Resizable panels with drag handles (0.2 / 0.4 / 0.4 default proportions)
- App launches in fullscreen

### Editor Toolbar (Outline-Style Icons)
Undo, Redo, Bold, Italic, Strikethrough, Highlight, Inline Code, H1–H6 dropdown, Ordered/Unordered/Task/Definition lists, Link, Image (file picker → base64 data URL), Footnote, Table (dialog: rows/cols/language/alignment), Code Block, Equations (`$$`), Horizontal Rule, Blockquote

### Bottom Floating Bar
| Icon | Label | Action |
|------|-------|--------|
| 📖 (book) | القرآن | Opens Quran search dialog |
| 📖 (book with person) | الحديث | Opens Hadith search dialog |
| 🪶 (feather pen) | شعر | Inserts poetry fenced block template |

### RTL & Theming
- Full RTL layout (`direction: rtl` on body)
- Dark theme (`--bg: #121212`, `--bg-panel: #1f2428`)
- Editor: Amiri serif font
- Preview: white background, `dir="auto"` on block elements
- Per-paragraph direction via `unicode-bidi: plaintext`
- Latin digits auto-converted to Arabic-Indic (٠–٩) in Arabic text in preview

### Undo/Redo
- History stack (max 200 entries)
- Ctrl+Z / Ctrl+Y support
- Auto-save via 500ms debounce + Ctrl+S

---

## Quran Integration

**Data source**: Tanzil.net (CC-BY-SA), `docs/quran-simple.txt` → parsed into `src/lib/quran.json`

**Search**: Substring matching with Arabic diacritic stripping + letter normalization

**Dialog features**:
- Search by Arabic text or surah name
- Single verse insert: `> ﴿verse text﴾ [surah: verse]`
- Range insert: `> ﴿text1 [surah: 1] text2 [surah: 2] … textN [surah: N]﴾ > [surah: 1-N]`

---

## Hadith Integration

**Data source**: `hadith-json-1.2.0` (9 major books: Bukhari, Muslim, Abudawud, Tirmidhi, Nasai, Ibn Majah, Ahmed, Darimi, Malik), loaded via custom Rust command from `docs/`

**Implementation**:
- Rust commands: `get_hadith_books`, `read_hadith_book`
- Fuse.js search with Arabic normalization (diacritic stripping + letter normalization)
- Books load lazily when dialog opens (59MB total, ~63,000 hadiths)
- Progress bar during loading

**Dialog features**:
- Search across all 9 books simultaneously
- Results show book badge, chapter name, hadith number
- Insert format: `> قَالَ رَسُولُ اللَّهِ ﷺ: «hadith text» [book: number]`

---

## Poetry Environment

**Syntax**: Fenced block with `poetry` language
```
```poetry
first half || second half
first half || second half
```
```

**Rendering**:
- CSS Grid: `1fr / gap(40–80px) / 1fr` for two-hemistich layout
- `text-align-last: justify` for Kashida-like stretching
- Responsive: stacks vertically on screens < 600px
- Amiri font, 1.35rem, RTL

---

## Persistence & File Operations
- Notes stored in Tauri app data dir: `{appDataDir}/scientific-writer/workspace/`
- Rust commands: `read_text_file`, `write_text_file`, `create_dir`, `remove_file`, `rename_file`, `file_exists`, `copy_file`
- Auto-save on edit + manual Ctrl+S

---

## Environment Setup
- **Rust target**: `stable-x86_64-pc-windows-msvc` (not GNU)
- Uninstalled Chocolatey Rust to fix LD export limit
- Dev server locked to port 1420
- `npm run tauri dev` launches full desktop app with hot reload

---

## Known Issues
- `src/lib/utils.ts` was missing at start — created with `debounce` and `createId`
- `$lib/components/` import path mismatch — components live in `src/components/`, not `src/lib/components/` (doesn't block build since `$lib` maps to `src/lib/`)
- A11y warnings for `autofocus` on search inputs (cosmetic only)
- Hadith and Quran search use Fuse.js threshold 0.35 — may miss rare phrases
- Image insertion uses base64 data URLs (large images bloat the .md file)
