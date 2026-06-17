# Architecture — Scientific Writer (الكاتب العلمي)

## Stack

| Layer        | Technology                                                          |
|-------------|---------------------------------------------------------------------|
| Desktop shell | Tauri v2 (Rust)                                                   |
| Frontend    | SvelteKit 2 + @sveltejs/adapter-static (SPA, SSR disabled)         |
| Language    | TypeScript (frontend), Rust (backend)                               |
| Bundler     | Vite 6, dev server on port 1420                                     |
| Markdown    | markdown-it v14 + @traptitech/markdown-it-katex                     |
| Syntax hl   | highlight.js                                                       |
| Search      | fuse.js (fuzzy hadith search)                                       |

---

## Folder Structure

```
scientific-writer/
├── ARCHITECTURE.md
├── AGENTS.md
├── package.json
├── svelte.config.js          # adapter-static with index.html fallback
├── tsconfig.json
├── static/
│
├── src/                      # SvelteKit frontend
│   ├── app.css               # Global styles: RTL layout, KaTeX, poetry, figures, tables
│   ├── App.svelte            # Root layout: three-panel (sidebar | editor | preview)
│   │
│   ├── routes/
│   │   ├── +layout.svelte    # Imports app.css, renders <slot />
│   │   ├── +layout.ts        # export const ssr = false
│   │   └── +page.svelte      # Mounts <App />
│   │
│   ├── components/
│   │   ├── Editor.svelte     # Textarea editor + toolbar + bottom bar + dialogs
│   │   ├── Preview.svelte    # Renders markdown→HTML with asset resolution
│   │   ├── HierarchyTree.svelte  # Note tree with add/rename/delete/drag
│   │   ├── TreeItem.svelte   # Recursive tree node component
│   │   ├── Outline.svelte    # Collapsible heading outline in sidebar
│   │   ├── Stats.svelte      # Collapsible statistics panel in sidebar
│   │   ├── CitationDialog.svelte # Citation picker — search bib entries, insert [@key]
│   │   ├── QuranDialog.svelte    # Quran search & insert dialog
│   │   └── HadithDialog.svelte   # Hadith search & insert dialog
│   │
│   └── lib/
│       ├── stores.ts         # Svelte writable/derived stores (state)
│       ├── fs.ts             # Tauri IPC wrappers for file operations
│       ├── markdown.ts       # Markdown pipeline: parse + render
│       ├── bibliography.ts   # BibTeX parser, citation formatting, bibliography generator
│       ├── stats.ts          # NoteStats interface + computeStats
│       ├── utils.ts          # createId(), debounce()
│       ├── hadith.ts         # Hadith data loading, normalization, fuzzy search
│       ├── quran.ts          # Quran data search, range selection, formatting
│       └── quran.json        # Quranic verses (embedded data)
│
├── src-tauri/                # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json       # Window config, CSP disabled, asset protocol
│   ├── capabilities/default.json  # Core permissions
│   ├── src/
│   │   ├── main.rs           # Entry point, calls lib::run()
│   │   └── lib.rs            # Tauri commands: file I/O, hadith, copy to assets
│   └── icons/
│
└── docs/
    ├── hadith-json-1.2.0/    # Hadith dataset (9 books, JSON files)
    │   └── db/by_book/the_9_books/
    │       ├── bukhari.json
    │       ├── muslim.json
    │       └── ...           # 9 books total
    ├── quran-simple.sql
    ├── quran-simple.txt
    └── quran-simple.xml
```

---

## Component Hierarchy

```
+page.svelte
  └── App.svelte
        ├── [left panel] HierarchyTree
        │     └── TreeItem (recursive)
        ├── [left panel] Outline
        ├── [left panel] Stats
        ├── [center] Editor
│     └── CitationDialog   (conditional overlay)
│     └── QuranDialog      (conditional overlay)
│     └── HadithDialog     (conditional overlay)
│     └── table dialog     (inline conditional)
        └── [right panel] Preview
```

### Panel layout (App.svelte)

- Three-column resizable layout: `leftWidth` | handle | center (flex: 1) | handle | `rightWidth`
- Left panel: 20% default → HierarchyTree + Outline + Stats stacked vertically
- Center: Editor (textarea + toolbar + bottom bar)
- Right panel: 40% default → Preview (rendered markdown)
- Drag handles between panels with `mousedown`/`mousemove`/`mouseup` listeners

---

## State Management

All state lives in Svelte stores (`src/lib/stores.ts`):

| Store              | Type              | Purpose                                      |
|--------------------|-------------------|----------------------------------------------|
| `hierarchy`        | `writable<TreeNode[]>` | Note/folder tree structure                |
| `activeNoteId`     | `writable<string\|null>` | Currently selected note ID               |
| `noteContent`      | `writable<string>` | Current note body text                       |
| `isSaving`         | `writable<boolean>` | Save-in-progress flag                       |
| `activeNote`       | `derived`         | Resolves active note metadata from hierarchy |
| `bibEntries`       | `writable<BibEntry[]>` | Parsed BibTeX entries from references.bib |
| `citedKeys`        | `writable<string[]>`  | Citation keys used in current note       |
| `missingCitationKeys` | `writable<string[]>` | Keys cited but missing from references.bib |
| `editorRef`        | `writable`        | HTMLTextAreaElement reference                |
| `previewRef`       | `writable`        | Preview div HTMLElement reference            |
| `activeHeadingId`  | `writable<string\|null>` | Currently scrolled heading ID         |
| `outlineItems`     | `derived`         | Parsed heading list from noteContent         |

### Data flow

1. `initWorkspace()` reads `hierarchy.json` → sets `hierarchy` store
2. User clicks note → `activeNoteId` changes → `readNote()` → `noteContent` updated
3. User types in editor → `handleInput` → `noteContent` updated → debounced auto-save (500ms)
4. `outlineItems` derived from `noteContent` → `Outline` renders headings
5. Editor scroll → `onEditorScroll` → `activeHeadingId` updated (Outline highlights + Preview syncs)
6. On app init: `readBibliography()` → `parseBibTeX()` → `bibEntries` store populated
7. Preview renders `renderMarkdown(content, bibEntries)` → `citedKeys` / `missingCitationKeys` stores updated
8. Ctrl+S triggers immediate save

---

## Rust Commands

Defined in `src-tauri/src/lib.rs`, invoked via `@tauri-apps/api/core` `invoke()`.

| Command              | Signature                                        | Purpose                                    |
|----------------------|--------------------------------------------------|--------------------------------------------|
| `greet`              | `(name: &str) -> String`                         | Placeholder                                |
| `get_workspace_dir`  | `(app) -> Result<String>`                        | Creates & returns `{appData}/scientific-writer/workspace/` |
| `read_text_file`     | `(path: String) -> Result<String>`               | Reads file content as string               |
| `write_text_file`    | `(path: String, content: String) -> Result<()>`  | Writes string to file (creates parents)    |
| `create_dir`         | `(path: String, recursive: bool) -> Result<()>`  | Creates directory                          |
| `remove_file`        | `(path: String) -> Result<()>`                   | Deletes file                               |
| `rename_file`        | `(old_path, new_path: String) -> Result<()>`     | Renames file                               |
| `file_exists`        | `(path: String) -> bool`                         | Checks if path exists                      |
| `copy_file`          | `(src, dest: String) -> Result<()>`              | Copies file                                |
| `copy_file_to_assets`| `(workspace, file_name: String, data: Vec<u8>) -> Result<String>` | Saves binary to `assets/`, returns relative path |
| `list_assets`        | `(workspace: String) -> Result<Vec<String>>`     | Lists files in `assets/` directory         |
| `get_hadith_books`   | `() -> Vec<&'static str>`                        | Returns 9 book keys                        |
| `read_hadith_book`   | `(book: String) -> Result<String>`               | Reads book JSON from `docs/hadith-json-.../` |

### Backend location

`project_root()` is derived from `CARGO_MANIFEST_DIR` parent (i.e. `scientific-writer/`). Hadith files are loaded from `docs/hadith-json-1.2.0/db/by_book/the_9_books/{book}.json`.

---

## Markdown Pipeline

All logic in `src/lib/markdown.ts`.

### renderMarkdown(text, bibEntries?) → HTML string

```
Input text
   │
   ▼
1. Pre-process: Arabic digit conversion
   │  - Skip code fences, inline code, math ($..$, $$..$$), image/link URLs,
   │    citation patterns ([@key])
   │  - Replace ASCII digits (0-9) with Arabic-Indic (٠-٩) on lines with Arabic text
   │  - Insert blank lines after non-table, non-fence lines for hard paragraph breaks
   │
   ▼
2. Extract table captions
   │  - Scan for lines matching /^(Table|جدول):\s*(\S.*)/
   │  - Collect caption text (may span multiple lines)
   │  - Remove caption lines from source
   │  - Map captions to table index
   │
   ▼
3. Citation replacement (if bibEntries provided)
   │  - Replace [@key] with formatted in-text citation
   │  - Multiple: [@key1; @key2] → (Author1, Year; Author2, Year)
   │  - Missing keys → (?key?) placeholder
   │  - Track usedKeys / missingKeys in module-level state
   │
   ▼
4. markdown-it render (with plugins)
   │  - katex plugin for $$ math
   │  - highlight.js for code block syntax highlighting
   │  - lang="poetry" → custom renderPoem() for Arabic poetry layout
   │  - Custom image render rule: every ![alt](src) becomes <figure class="figure">
   │    with auto-numbered caption Figure/الشكل N[: alt text]
   │
   ▼
5. Post-process: dir="auto" injection
   │  - Inject dir="auto" on p, h1-h6, blockquote, pre, th, td, li
   │  - ul/ol dir from content scan (Arabic → rtl)
   │  - table dir from content scan (Arabic → rtl)
   │
   ▼
6. Inject table captions
   │  - Wrap every <table> in <figure class="table-figure">
   │  - Add <figcaption> Table/جدول N[: caption text] above table
   │
   ▼
7. Append bibliography (if citations used)
   │  - Generate <section class="bibliography"> with numbered entries
   │  - Heading: "المراجع" (Arabic refs) or "References" (English refs)
   │  - List missing citations in warning box
   │
   ▼
Output HTML (passed to Preview.svelte)
```

### parseFigures(markdown) → FigureInfo[]
- Scans markdown source for `![alt](src)` patterns
- Returns array of `{ id, number, src, caption }`

### parseTables(markdown) → TableInfo[]
- Scans markdown source for pipe-table lines and `Table:`/`جدول:` caption syntax
- Returns array of `{ id, number, caption }`

### parseOutline(markdown) → OutlineItem[]
- Splits text by lines, skips code fences
- Matches `#{1,6} heading_text` lines
- Returns `{ id, level, text, lineIndex, charOffset }`

### Figure numbering
- `figCounter` resets each `renderMarkdown()` call
- IDs generated from filename base: `fig-{filename}` with dedup suffix
- Figure count = image count (every image is a figure)

### Table numbering
- Sequential `tbl-{N}` based on table appearance order
- Caption source: `Table: text` or `جدول: نص` on line preceding the table

### Arabic digit conversion (`convertArabicDigits`)
- Splits text by regex preserving inline code, math, image/link URLs, citation patterns (`[@key]`)
- Only replaces digits in non-protected segments
- Only activates on lines containing Arabic Unicode characters

---

## Preview Pipeline

`src/components/Preview.svelte`

```
noteContent store ─┐
bibEntries  store ─┤
                  ▼
renderMarkdown(content, entries) ← markdown.ts
   │                               (citations replaced, bibliography appended)
   ▼
resolveAssets(html)            ← replace src="assets/..." with convertFileSrc(workspaceDir + '/assets/...')
   │                              (converts to Tauri asset protocol URL)
   ▼
{@html html}                   ← innerHTML in <div class="preview" dir="auto">
   │
   ▼
getLastCitationResult()        ← read module-level usedKeys/missingKeys
   │                              → update citedKeys / missingCitationKeys stores
```

### Preview container styles (app.css)
- `.preview { direction: ltr; }` — base direction of preview area
- `.preview [dir] { text-align: start; }` — respects `dir` attribute per element
- `.preview :is(pre, table) { direction: ltr; }` — code and tables always LTR
- `.preview :is(ul, ol) { direction: auto; unicode-bidi: plaintext; }` — list direction auto-detected
- KaTeX: `direction: ltr; unicode-bidi: isolate;`
- Figures centered, figure captions italicized

---

## Storage Model

### Workspace location
`{appDataDir}/scientific-writer/workspace/` (resolved by `tauri::path::app_data_dir()`)

### File layout
```
workspace/
├── hierarchy.json      # Note tree as TreeNode[] JSON
├── references.bib      # BibTeX reference database (optional)
├── {note-id}.md        # Individual note files
└── assets/
    └── {image-files}   # Uploaded images (copied via copy_file_to_assets)
```

### hierarchy.json format
```json
[
  {
    "id": "folder-a",
    "name": "Folder A",
    "type": "folder",
    "expanded": true,
    "children": [
      { "id": "note-1", "name": "Note1.md", "type": "note" }
    ]
  },
  { "id": "note-3", "name": "Note3.md", "type": "note" }
]
```

### Initialization flow
1. `initWorkspace()` calls `get_workspace_dir()` (creates dir on first call)
2. Tries to read `hierarchy.json`
3. If not found: creates default hierarchy (2 folders, 3 notes with sample content)
4. Writes default files via `write_text_file`
5. Returns `TreeNode[]` → set into `hierarchy` store
6. `readBibliography()` reads `references.bib` from workspace (returns empty string if missing)
7. If content found: `parseBibTeX()` → `BibEntry[]` → set into `bibEntries` store

### Save flow
- Auto-save: 500ms debounce on `noteContent` change → `writeNote(id, content)`
- Manual: Ctrl+S → same `writeNote` call
- Hierarchy changes (rename, delete, add, drag) → `saveHierarchy(nodes)` writes `hierarchy.json`

### Note file naming
- Files stored as `{id}.md` where `id` is from `createId()` (timestamp + counter)
- Display name is `node.name` in the hierarchy (not the filename)

---

## Bibliography & Citations

### Architecture

All logic in `src/lib/bibliography.ts`. Formatters are isolated functions, designed to be swappable with a CSL-based implementation in the future.

### BibTeX Parser

- Parses standard `.bib` files: `@article{key, author = {...}, ...}`
- Supports brace-delimited `{value}` and quote-delimited `"value"` fields
- Handles nested braces in values (e.g., `{The {B}ook Title}`)
- Skips `@string`, `@preamble`, `@comment` directives
- Returns `BibEntry[]` with `{ key, type, fields }` structure

### Citation Syntax

| Input                                    | Output                                       |
|------------------------------------------|----------------------------------------------|
| `[@smith2024]`                           | `(Smith, 2024)`                              |
| `[@smith2024; @jones2023]`               | `(Smith, 2024; Jones, 2023)`                 |
| `[@arabic2024]` (Arabic entry)           | `(محمد، ٢٠٢٤)`                               |
| `[@unknown]` (missing key)              | `(?unknown?)`                                |

### Author formatting rules

- 1 author → `Last`
- 2 authors → `Last1 & Last2` (Arabic: `Last1 وLast2`)
- 3+ authors → `Last1 et al.` (Arabic: `Last1 وآخرون`)
- Language detection: scans `author` + `title` fields for Arabic Unicode characters

### Bibliography generation

- Appended automatically after rendered content (behind `<hr>`)
- Heading: `المراجع` if any entry contains Arabic text, otherwise `References`
- Entries numbered in order of first appearance (`[1]`, `[2]`, ...)
- Formatting varies by entry type:
  - `article`: `[1] Author (Year). Title. Journal, Volume(Issue), Pages.`
  - `book`: `[1] Author (Year). Title. Edition. Publisher.`
  - `inproceedings`: `[1] Author (Year). Title. In Booktitle. Publisher, Pages.`
  - `phdthesis`/`mastersthesis`: `[1] Author (Year). Title. PhD thesis. School.`
  - default: `[1] Author (Year). Title.`

### Missing citation detection

- Keys cited via `[@key]` that don't exist in `references.bib` → tracked in `missingCitationKeys` store
- In-text: shown as `(?key?)` inline
- Bibliography: warning box with `Missing references` / `المراجع غير الموجودة` listing all missing keys

### Citation picker dialog (`CitationDialog.svelte`)

Opened via the "استشهاد" button in the editor's bottom bar.

- **Search**: Fuse.js fuzzy search across `author`, `title`, `year` fields (threshold 0.4)
- **Results**: Shows author, year, title, citation key, and entry type per row
- **Insert**: Click or Enter → inserts `[@key]` at cursor via Editor's `insertAtCursor`
- **Keyboard**: `↑`/`↓` navigate results, `Enter` selects, `Escape` closes
- **Empty state**: Shows message if `references.bib` is missing or empty
- **Architecture**: Reads from `bibEntries` store (populated by `App.svelte` on init). A future Zotero backend would replace the store's data source while the dialog code stays unchanged.

### CSL future support

The formatting pipeline is structured as standalone exported functions (`formatInText`, `formatBibliographyEntry`, `generateBibliographyHtml`, `replaceCitations`). A future CSL backend would:
1. Replace `formatInText` and `formatBibliographyEntry` with CSL-based formatting
2. Pass `CitationFormatter` strategy through the pipeline
3. No changes needed to `BibEntry` interface, parser, or citation regex

### Data flow

```
references.bib (on disk)
   │
   ▼
readBibliography() ← fs.ts
   │
   ▼
parseBibTeX()      ← bibliography.ts
   │
   ▼
bibEntries store   ← stores.ts
   │
   ▼
renderMarkdown(content, entries) ← markdown.ts
   │  ├─ replaceCitations() → formatted text + usedKeys + missingKeys
   │  └─ generateBibliographyHtml() → HTML section appended to output
   ▼
Preview.svelte     ← updates citedKeys / missingCitationKeys stores
```

---

## Islamic Reference Tools

### Quran search (`src/lib/quran.ts`)
- Embedded `quran.json` contains all 6236 verses
- Search: normalize Arabic (strip diacritics, normalize alif/ya/ta/ha/waw) → case-insensitive substring match
- Range insertion: user picks surah + from/to ayah → formatted block quote
- Format: `> ﴿text﴾ [surahName: ayah]` or multi-verse format

### Hadith search (`src/lib/hadith.ts`)
- Data loaded via Rust command `read_hadith_book` from `docs/hadith-json-...`
- 9 books total: abudawud, ahmed, bukhari, darimi, ibnmajah, malik, muslim, nasai, tirmidhi
- Lazy-loaded on first dialog mount via `loadAllHadiths()`
- Fuzzy search via fuse.js with normalized Arabic (same normalization as Quran)
- Format: `> قَالَ رَسُولُ اللَّهِ ﷺ: «text» [bookTitle: idInBook]`

---

## History / Undo-Redo (Editor.svelte)

- `history: string[]` — up to 200 editor snapshots
- `historyIndex` — current position in history
- `pushHistory()` called before every editor mutation
- Ctrl+Z/Ctrl+Y wired to undo/redo
- `ignoreNextInput` flag prevents duplicate history entries on programmatic `setValue()` calls

---

## Direction & Bidi Handling

- Body: `direction: rtl`
- Editor textarea: `dir="auto"` + `unicode-bidi: plaintext` + `text-align: start`
- Preview container: `dir="auto"` (auto-detects from content)
- Block elements (p, h1-h6, blockquote, pre, th, td, li): `dir="auto"` injected via HTML post-processing
- Lists (ul/ol): dir determined by scanning first `<li>` for Arabic characters
- Tables: dir determined by scanning entire table content for Arabic characters
- KaTeX elements: forced `direction: ltr; unicode-bidi: isolate`
- LRM/RLM marks can be inserted at line start to influence `dir="auto"` detection (no special syntax needed)

---

## Key Conventions

- Every image is a figure (centered, auto-numbered caption)
- Every table is wrapped in `<figure class="table-figure">` (auto-numbered caption)
- Figure/table IDs are sequential within a render pass: `fig-N`, `tbl-N`
- Caption syntax: `Table: caption text` or `جدول: نص` on line(s) preceding the table
- `convertArabicDigits` avoids corrupting image/link URLs and code content
- All UI labels are in Arabic
- Component styles use scoped `<style>` blocks; global styles in `app.css`
- Poetry: fenced code block with `poetry` language, verses split by `||`
