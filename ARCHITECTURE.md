# Architecture — Scientific Writer (الكاتب العلمي)

## Stack

| Layer        | Technology                                                          |
|-------------|---------------------------------------------------------------------|
| Desktop shell | Tauri v2 (Rust)                                                   |
| Frontend    | SvelteKit 2 + @sveltejs/adapter-static (SPA, SSR disabled)         |
| Language    | TypeScript (frontend), Rust (backend)                               |
| Bundler     | Vite 6, dev server on port 1420                                     |
| Markdown    | markdown-it v14 + @traptitech/markdown-it-katex + markdown-it-container + markdown-it-footnote |
| Syntax hl   | highlight.js                                                       |
| Search      | fuse.js (fuzzy hadith search) + custom full-text search engine     |
| Hijri date  | @umalqura/core                                                     |
| Dictionary  | rusqlite with 10 embedded Arabic lexicons                          |
| Export      | docx (via Pandoc), LaTeX, Markdown, Typst (via AST-based exporters)|

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
│   │   ├── Editor.svelte        # Textarea editor + toolbar + bottom bar + dialogs
│   │   ├── Preview.svelte       # Renders markdown→HTML + wiki link click navigation
│   │   ├── HierarchyTree.svelte # Note tree with add/rename/delete/drag
│   │   ├── TreeItem.svelte      # Recursive tree node component
│   │   ├── Outline.svelte       # Collapsible heading outline in sidebar
│   │   ├── BacklinksPanel.svelte # Collapsible incoming wiki links panel
│   │   ├── Stats.svelte         # Collapsible statistics panel in sidebar
│   │   ├── SplashScreen.svelte  # Startup splash with credits & tech info
│   │   ├── SearchDialog.svelte  # Full-text search across all notes (keyword + vector)
│   │   ├── CitationDialog.svelte # Citation picker — search bib entries, insert [@key]
│   │   ├── QuranDialog.svelte   # Quran search & insert dialog
│   │   ├── HadithDialog.svelte  # Hadith search & insert dialog
│   │   ├── EquationDialog.svelte # LaTeX equation editor & insert
│   │   ├── EnvironmentDialog.svelte # Academic block environment inserter
│   │   ├── DiacriticDialog.svelte # Diacritic (tashkeel) character palette
│   │   ├── DictionaryDialog.svelte # Arabic dictionary lookup (10 lexicons)
│   │   ├── TafqitDialog.svelte  # Number-to-Arabic-words (تفقيط) converter
│   │   ├── DateDialog.svelte    # Hijri/Gregorian date picker & format inserter
│   │   ├── KatexGallery.svelte  # KaTeX symbol reference gallery
│   │   └── NewProjectDialog.svelte # New project/template creator
│   │
│   └── lib/
│       ├── stores.ts         # Svelte writable/derived stores (state)
│       ├── fs.ts             # Tauri IPC wrappers for file operations
│       ├── markdown.ts       # Markdown pipeline: parse + render
│       ├── markdown-classical.ts # Classical Arabic book layout plugin (interlinear gloss)
│       ├── bibliography.ts   # BibTeX parser, citation formatting, bibliography generator
│       ├── citation-arabic.ts # Arabic CSL strings, manuscript & Ṭabaqāt formatters
│       ├── backlinks.ts      # Wiki link extraction, backlinks index builder & renderer
│       ├── stats.ts          # NoteStats interface + computeStats
│       ├── utils.ts          # createId() (crypto.randomUUID), debounce()
│       ├── hadith.ts         # Hadith data loading, normalization, fuzzy search
│       ├── quran.ts          # Quran data search, range selection, formatting
│       ├── quran.json        # Quranic verses (embedded data)
│       ├── kashida.ts        # Kashida (tatweel) justification engine
│       ├── blocks.ts         # Academic block plugin (::: theorem, proof, etc.)
│       ├── footnotes.ts      # Footnote rendering & endnote mode toggle
│       ├── search.ts         # Full-text search index builder & keyword/vector/hybrid search
│       ├── hijri.ts          # Hijri/Gregorian calendar conversion (@umalqura/core)
│       ├── tafqit.ts         # Arabic number-to-words (تفقيط) conversion
│       ├── declarations.d.ts # Ambient type declarations
│       │
│       ├── templates/        # Project template system
│       │   ├── index.ts      # Template registry (registerTemplate, getTemplate, getAllTemplates)
│       │   ├── types.ts      # Template interface & TemplateId type
│       │   ├── thesis.ts     # Thesis template (4 folders, 10+ notes)
│       │   ├── article.ts    # Research article template
│       │   ├── book.ts       # Academic book template
│       │   ├── lecture.ts    # Lecture notes template
│       │   └── classical-book.ts # Classical Islamic book template (matn/sharh/hashiyah)
│       │
│       ├── typography/       # Font/typography utilities (empty, future use)
│       │
│       └── publishing/       # Publishing abstraction layer
│           ├── index.ts      # Barrel exports
│           ├── ast.ts        # AST node types (BlockNode, InlineNode, DocumentModel)
│           ├── exporter.ts   # Exporter interface + pluggable registry
│           ├── document.ts   # markdown→AST parser (DocumentModel)
│           └── manuscript.ts # Manuscript compiler — merges chapters → unified AST
│
├── src-tauri/                # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json       # Window config, strict CSP, runtime-scoped asset protocol
│   ├── capabilities/default.json  # Core window + opener permissions only
│   ├── src/
│   │   ├── main.rs           # Entry point, calls lib::run()
│   │   ├── workspace.rs      # Trusted-root registry, path resolution, atomic writes
│   │   └── lib.rs            # Tauri commands: workspace, file I/O, hadith, assets
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
        ├── SplashScreen  (conditional, auto-dismiss 5s)
        ├── [left panel] HierarchyTree
        │     └── TreeItem (recursive)
        ├── [left panel] Outline
        ├── [left panel] BacklinksPanel
        ├── [left panel] Stats
        ├── [center] Editor
        │     ├── QuranDialog         (conditional overlay)
        │     ├── HadithDialog        (conditional overlay)
        │     ├── CitationDialog      (conditional overlay)
        │     ├── EquationDialog      (conditional overlay)
        │     ├── EnvironmentDialog   (conditional overlay)
        │     ├── DiacriticDialog     (draggable floating palette)
        │     ├── DictionaryDialog    (conditional overlay)
        │     ├── TafqitDialog        (conditional overlay)
        │     ├── DateDialog          (conditional overlay)
        │     ├── wiki link dialog    (inline conditional)
        │     └── table dialog        (inline conditional)
        └── [right panel] Preview
```

### Panel layout (App.svelte)

- Three-column resizable layout: `leftWidth` | handle | center (flex: 1) | handle | `rightWidth`
- Left panel: 20% default → HierarchyTree + Outline + BacklinksPanel + Stats stacked vertically
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
| `backlinksIndex`   | `writable<Map<string, string[]>>` | targetId → sourceIds reverse index |
| `currentBacklinks` | `derived`         | Resolved `{id, name}[]` for active note     |
| `editorRef`        | `writable`        | HTMLTextAreaElement reference                |
| `previewRef`       | `writable`        | Preview div HTMLElement reference            |
| `activeHeadingId`  | `writable<string\|null>` | Currently scrolled heading ID         |
| `outlineItems`     | `derived`         | Parsed heading list from noteContent         |
| `digitStyle`       | `writable<DigitStyle>` | Arabic digit conversion style ('auto'\|'eastern'\|'western') |
| `ligatureSettings` | `writable<LigatureSettings>` | OpenType font feature toggles      |
| `fontSettings`     | `writable<FontSettings>` | Font family, weight, optical size, width |
| `kashidaConfig`    | `writable<KashidaConfig>` | Kashida justification settings        |

### Data flow

1. `initWorkspace()` reads `hierarchy.json` → sets `hierarchy` store
2. User clicks note → `activeNoteId` changes → `readNote()` → `noteContent` updated
3. User types in editor → `handleInput` → `noteContent` updated → debounced auto-save (500ms)
4. `outlineItems` derived from `noteContent` → `Outline` renders headings
5. Editor scroll → `onEditorScroll` → `activeHeadingId` updated (Outline highlights + Preview syncs)
6. On app init: `readBibliography()` → `parseBibTeX()` → `bibEntries` store populated
7. Preview renders `renderMarkdown(content, bibEntries)` → `citedKeys` / `missingCitationKeys` stores updated
8. On app init: `buildBacklinksIndex(hierarchy)` → `backlinksIndex` store populated
9. On noteContent change: `updateBacklinksForNote()` → `backlinksIndex` updated incrementally
10. Ctrl+S triggers immediate save

---

## Backlinks System

### Architecture (`src/lib/backlinks.ts`)

Wiki links use `[[Note Name]]` syntax, optionally with display text: `[[Note Name|Display Text]]`.

| Function | Purpose |
|----------|---------|
| `extractWikiLinks(content)` | Parses `[[...]]` patterns, returns target name strings |
| `buildNameToIdMap(hierarchy)` | Maps `TreeNode.name` (sans `.md`) → `node.id` |
| `resolveWikiLink(targetName, hierarchy)` | Resolves a name to a note ID (or null) |
| `buildBacklinksIndex(hierarchy)` | Scans all notes, builds `Map<targetId, sourceIds[]>` (async) |
| `updateBacklinksForNote(index, sourceId, content, hierarchy)` | Incremental update when one note changes |
| `renderWikiLinks(html, hierarchy)` | Converts `[[...]]` → `<a data-note-id="...">` in rendered HTML |

### Index building

- **Full scan**: `buildBacklinksIndex()` traverses the hierarchy tree, reads every note via `readNote()`, extracts wiki links, builds the reverse map. Called on app init.
- **Incremental update**: When `noteContent` changes (user typing), `updateBacklinksForNote()` removes the current note from all source lists, re-scans its content, and re-inserts links. No full re-scan on every keystroke.
- Name resolution matches against `TreeNode.name` with `.md` stripped. First match wins for duplicate names.

### Data flow

```
hierarchy store
    │
    ▼
buildBacklinksIndex(hierarchy)  ← on init
    │
    ▼
backlinksIndex store  (Map<targetId, sourceIds[]>)
    │                       ▲
    │                       │ updateBacklinksForNote()  ← on noteContent change
    ▼                       │
currentBacklinks (derived) ─┘  ← resolved to {id, name}[]
    │
    ▼
BacklinksPanel.svelte  ← renders clickable list
```

### UI (`BacklinksPanel.svelte`)

- Collapsible section below Outline in the left sidebar
- Header shows "الروابط الواردة" with count badge
- Each item is a clickable button showing the source note's display name
- Click sets `activeNoteId` → navigates to the source note
- Empty state: "لا توجد روابط واردة"
- Styled consistently with Outline and Stats panels

### Preview integration (`Preview.svelte`)

- After markdown→HTML rendering, `renderWikiLinks()` converts `[[Name]]` to `<a class="wiki-link-resolved" data-note-id="ID">` (or `<span class="wiki-link-missing">` for unresolvable targets)
- Click handler on preview div captures `click` events, checks for `a.wiki-link-resolved` via `closest()`, prevents default navigation, sets `$activeNoteId`
- Keyboard: `Enter` on focused wiki link (via `on:keydown` → `role="none"` on preview div to satisfy a11y)

### Editor insertion

- Toolbar button (chain link with `+` indicator) opens a searchable dialog
- Dialog lists all notes from hierarchy, filtered by text input
- Selecting a note inserts `[[Note Name]]` at cursor

---

## Rust Commands

Defined in `src-tauri/src/lib.rs`, invoked via `@tauri-apps/api/core` `invoke()`.
Every path coming from the webview is resolved by
`WorkspaceRegistry::resolve()` (see `src-tauri/src/workspace.rs`); commands
never touch a raw path directly. Commands marked *async* run their I/O/CPU work
in `tauri::async_runtime::spawn_blocking`, so the window stays responsive.

| Command                   | Signature                                        | Purpose                                    |
|---------------------------|--------------------------------------------------|--------------------------------------------|
| `get_workspace_dir`       | `(app, ws) -> Result<String>`                    | Creates/trusts & returns `{appData}/scientific-writer/workspace/` |
| `pick_workspace`          | *async* `(app, ws) -> Result<Option<String>>`    | Native folder picker; picked folder becomes trusted |
| `open_workspace`          | *async* `(app, ws, path) -> Result<String>`      | Opens a trusted folder; asks natively before trusting a new one |
| `list_files`              | `(ws, dir) -> Result<Vec<String>>`               | Lists plain files directly inside `dir` (e.g. `.backups`) |
| `read_text_file`          | `(ws, path) -> Result<String>`                   | Reads file content as string               |
| `read_binary_file`        | *async* `(app, path) -> Result<Vec<u8>>`         | Reads file content as binary bytes         |
| `write_text_file`         | `(ws, path, content) -> Result<()>`              | Atomic write (temp file + rename)          |
| `create_dir`              | `(ws, path, recursive) -> Result<()>`            | Creates directory                          |
| `remove_file`             | `(ws, path) -> Result<()>`                       | Deletes file                               |
| `rename_file`             | `(ws, old_path, new_path) -> Result<()>`         | Renames file                               |
| `file_exists`             | `(ws, path) -> bool`                             | Checks if path exists                      |
| `copy_file`               | `(ws, src, dest) -> Result<()>`                  | Copies file atomically                     |
| `copy_file_to_assets`     | `(ws, workspace, file_name, data) -> Result<String>` | Validates basename, writes to `assets/`, returns relative path |
| `list_assets`             | `(ws, workspace) -> Result<Vec<String>>`         | Lists files in `assets/` directory         |
| `get_hadith_books`        | `() -> Vec<&'static str>`                        | Returns 9 book keys                        |
| `read_hadith_book`        | *async* `(app, book) -> Result<String>`          | Reads bundled `hadith/<book>.json`         |
| `export_pandoc`           | *async* `(app, workspace, markdown, format) -> Result<Vec<u8>>` | Converts markdown via Pandoc; only `docx`, `odt`, `epub`, `html` |
| `search_dictionary`       | *async* `(app, query, dict_table?, search_mode?, dict_group?) -> Result<Vec<DictEntry>>` | Searches Arabic lexicons (word/root) |
| `list_dictionaries`       | `() -> Vec<serde_json::Value>`                   | Lists all 10 available dictionary tables   |
| `check_spelling`          | *async* `(app, text) -> Result<Vec<SpellError>>` | Checks Arabic text with Hunspell           |

### Resource locations

`resource_path()` resolves `<resource_dir>/<bundled>` in production and falls
back to the repository path in debug builds only:

- Ḥadīth: `hadith/<book>.json` (bundled) → `docs/hadith-json-1.2.0/db/by_book/the_9_books/<book>.json` (dev)
- Dictionaries: `db/dicts.sqlite` (bundled) → `src-tauri/db/dicts.sqlite` (dev)
- Hunspell: `hunspell/` (bundled) → `src-tauri/resources/hunspell/` (dev)

### Workspace trust model

- The default app-data workspace is always trusted.
- `pick_workspace` and `open_workspace` are the only ways to add another root;
  both show Rust-side native UI that page content cannot forge.
- Trusted roots persist in `{appConfigDir}/trusted-workspaces.json`.
- `resolve()` rejects relative paths, `..` components and paths that escape a
  trusted root after following symlinks/junctions.
- The asset protocol starts with an empty scope; each trusted root is added at
  runtime via `asset_protocol_scope().allow_directory()`.

---

## Markdown Pipeline

All logic in `src/lib/markdown.ts`.

### Rendering security

Every HTML string injected with `{@html}` (preview, dialogs, search snippets,
print iframe) passes through `sanitizeHtml()` in `src/lib/sanitize.ts`.
DOMPurify keeps KaTeX/MathML/SVG markup and the app's classes/`data-*`, while
stripping scripts, iframes, event handlers and `javascript:` URLs. External
`http(s)`/`mailto` links are routed to the system browser by
`src/lib/external-links.ts`.

### renderMarkdown(text, bibEntries?, digitStyle?) → HTML string

```
Input text
   │
   ▼
1. Pre-process: Arabic digit conversion
   │  - Skip code fences, inline code, math ($..$, $$..$$), image/link URLs,
   │    citation patterns ([@key]), [ref:…] refs, {#eq:…} labels, [^N] footnote refs
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
3. Equation parsing
   │  - Extract $$...$$ blocks outside code fences
   │  - Strip {#eq:label} suffix, store in equationInfos[]
   │
   ▼
4. Citation replacement (if bibEntries provided)
   │  - Replace [@key] with formatted in-text citation
   │  - Multiple: [@key1; @key2] → (Author1, Year; Author2, Year)
   │  - Prefixes: [@ms:key] forces manuscript format, [@tab:key] forces Ṭabaqāt
   │  - Missing keys → (?key?) placeholder
   │  - Track usedKeys / missingKeys in module-level state
   │
   ▼
5. Interlinear gloss pre-processor
   │  - renderInterlinearGloss() for classical Arabic book layout
   │
   ▼
6. markdown-it render (with plugins)
   │  - katex plugin for $$ math
   │  - highlight.js for code block syntax highlighting
   │  - lang="poetry" → custom renderPoem() for Arabic poetry layout
   │  - Custom image render rule: every ![alt](src) becomes <figure class="figure">
   │    with auto-numbered caption Figure/الشكل N[: alt text]
   │  - academicBlocksPlugin for ::: theorem, proof, etc.
   │  - footnotePlugin for [^N] footnotes
   │  - classicalBookPlugin for classical Arabic book formatting
   │
   ▼
7. Post-process: dir="auto" injection
   │  - Inject dir="auto" on p, h1-h6, blockquote, pre, th, td, li
   │  - ul/ol dir from content scan (Arabic → rtl)
   │  - table dir from content scan (Arabic → rtl)
   │
   ▼
8. Inject table captions
   │  - Wrap every <table> in <figure class="table-figure">
   │  - Add <figcaption> Table/جدول N[: caption text] above table
   │
   ▼
9. Equation figure wrapping
   │  - Wrap displayed equations in <figure class="equation-figure">
   │  - Add numbered <figcaption> (N)
   │
   ▼
10. Equation reference resolution
    │  - Replace [ref:eq:label] / [ref:eq:N] with <a href="#eq-…">(N)</a>
    │
    ▼
11. Academic block reference resolution
    │  - resolveBlockRefs() for cross-refs within theorem environments
    │
    ▼
12. Append bibliography (if citations used)
    │  - Generate <section class="bibliography"> with numbered entries
    │  - Heading: "المراجع" (Arabic refs) or "References" (English refs)
    │  - List missing citations in warning box
    │
    ▼
Output HTML (passed to Preview.svelte for further wiki link rendering)
```

### Auxiliary parsers

| Function | Returns | Purpose |
|----------|---------|---------|
| `parseEquationsFromText(text)` | `EquationInfo[]` | Extract equation metadata for ref numbering |
| `parseFigures(markdown)` | `FigureInfo[]` | Scans `![alt](src)` patterns |
| `parseTables(markdown)` | `TableInfo[]` | Scans pipe tables + caption syntax |
| `parseOutline(markdown)` | `OutlineItem[]` | Heading extraction for Outline panel |

### Figure numbering
- `figCounter` resets each `renderMarkdown()` call
- IDs generated from filename base: `fig-{filename}` with dedup suffix `-2`, `-3`, ...
- Figure count = image count (every image is a figure)

### Table numbering
- Sequential `tbl-{N}` based on table appearance order
- Caption source: `Table: text` or `جدول: نص` on line preceding the table

### Equation numbering
- Sequential `(N)` displayed in right-aligned figcaption
- Labels via `{#eq:label}` suffix on `$$...$$` block → referenceable as `[ref:eq:label]`
- Unlabeled equations numbered automatically as `eq-{N}`

### Arabic digit conversion (`convertArabicDigits`)
- Splits text by regex preserving protected segments (code, math, URLs, citations, refs, labels, footnotes)
- Only replaces digits in non-protected segments
- Only activates on lines containing Arabic Unicode characters

---

## Publishing Architecture

The publishing layer decouples document content from output formats. All exporters consume a shared AST (`DocumentModel`) rather than raw markdown.

### Architecture overview

```
Markdown text
    │
    ▼
DocumentModel (AST)  ←─ parseDocument() / createDocument()
    │                     src/lib/publishing/document.ts
    │
    ├──► DocxExporter     (via Pandoc, Rust command `export_pandoc`)
    ├──► MarkdownExporter (YAML frontmatter + AST→Markdown)
    ├──► LatexExporter    (XeLaTeX/polyglossia for Arabic, pdfLaTeX for LTR)
    └──► TypstExporter    (Typst markup with RTL support)
         │
         ▼
    ExportResult { content, extension, mime }
```

### AST node hierarchy (`src/lib/publishing/ast.ts`)

The AST is a tree of discriminated union nodes with a `type` discriminant.

**Inline nodes** (appear inside paragraphs, headings, list items, etc.):

| Type | Fields | Purpose |
|------|--------|---------|
| `text` | `value: string` | Plain text |
| `strong` | `children: InlineNode[]` | Bold |
| `emphasis` | `children: InlineNode[]` | Italic |
| `strikethrough` | `children: InlineNode[]` | ~~Strikethrough~~ |
| `inlineCode` | `value: string` | `code` |
| `inlineMath` | `value: string` | `$...$` LaTeX |
| `link` | `url, title?, children` | `[text](url)` |
| `inlineImage` | `src, alt, title?` | `![alt](src)` |
| `footnoteRef` | `id: string` | `[^N]` |
| `citation` | `key: string` | `[@key]` |
| `equationRef` | `ref: string` | `[ref:eq:...]` |
| `blockRef` | `ref: string` | `[ref:type:...]` |
| `wikiLink` | `target, display?` | `[[Note]]` |
| `lineBreak` | — | Hard line break |

**Block nodes** (top-level document structure):

| Type | Fields | Purpose |
|------|--------|---------|
| `heading` | `level, children, id?` | `# title` |
| `paragraph` | `children: InlineNode[]` | Text paragraph |
| `thematicBreak` | — | `---` / `***` |
| `codeBlock` | `language?, value` | Fenced code |
| `blockquote` | `children: BlockNode[]` | `>` quotation |
| `list` | `ordered, start?, tight, items` | Bullet/numbered list |
| `listItem` | `checked?, children` | Single list entry |
| `imageFigure` | `src, alt, title?, caption?, id?, number?` | Standalone `![]()` image |
| `table` | `header, body, caption?, id?, number?` | Pipe table |
| `mathBlock` | `value, label?, id?, number?` | `$$...$$` display math |
| `footnoteDefinition` | `id, children` | `[^N]: text` |
| `poetry` | `verses: PoetryVerse[]` | Poetry fence (`` ```poetry ``) |
| `academicBlock` | `blockType, label?, id?, number?, children` | `::: theorem` etc. |
| `matn` | `children` | Classical book core text |
| `sharh` | `children` | Classical book commentary |
| `hashiyah` | `children` | Classical book marginal gloss |
| `htmlBlock` | `value: string` | Raw HTML pass-through |
| `figureGroup` | `kind, children, caption?, id?, number?` | Wrapper for captioned figure/table/equation |

### DocumentModel interface

```typescript
interface DocumentModel {
  meta: DocumentMeta;       // title, author, date, lang, direction
  blocks: BlockNode[];      // top-level block nodes
  bibEntries: BibEntry[];   // parsed bibliography entries
  errors: string[];         // parse warnings/errors
}
```

### Parser (`src/lib/publishing/document.ts`)

`parseDocument(markdown, bibEntries?)` converts raw markdown text into a `DocumentModel` using a line-by-line state machine.

- Recognises: headings, paragraphs, code fences, poetry fences, math blocks (`$$`), blockquotes, ordered/unordered lists, pipe tables, image figures, thematic breaks, inline formatting, wiki links, citations, equation/block refs, footnotes, academic block fences (`:::`), classical book containers (`:::matn`, `:::sharh`, `:::hashiyah`, `:::page`)
- Handles nesting through a `containerStack` (blockquotes, lists, academic blocks, classical containers)
- Inline content parsed via `parseInline(text)` using ordered regex rules
- Returns `errors[]` for recoverable parse issues

### Exporter interface (`src/lib/publishing/exporter.ts`)

```typescript
interface Exporter {
  readonly name: string;           // 'html', 'latex', 'typst', etc.
  readonly label: string;          // Arabic display name ('HTML', 'لا텍')
  readonly extensions: string[];   // ['html'], ['pdf'], ['tex']
  export(model: DocumentModel): ExportResult | Promise<ExportResult>;
}

interface ExportResult {
  content: string;                 // exported file content
  extension: string;               // file extension without dot
  mime: string;                    // MIME type
}
```

**Contract**: `export()` receives an already-parsed `DocumentModel`. The exporter must NOT read raw markdown, call the markdown-it renderer, or access any rendering pipeline. It works purely from the AST.

### Exporter registry

| Function | Purpose |
|----------|---------|
| `registerExporter(exporter)` | Register a new exporter (replaces existing by name) |
| `unregisterExporter(name)` | Remove an exporter |
| `getExporter(name)` | Look up by name |
| `listExporters()` | List all registered exporters |
| `hasExporter(name)` | Check if registered |
| `exportDocument(model, name)` | Convenience: export using a named exporter |

Registration is open-ended — any code can call `registerExporter()` with a custom `Exporter` object. This makes future exporters pluggable without modifying the core.

### Current exporters

| Exporter | File | Method | Notes |
|----------|------|--------|-------|
| **DOCX** | `docx-exporter.ts` | Calls `export_pandoc` Rust command | Requires Pandoc installed or bundled `pandoc.exe` next to app |
| **Markdown** | `markdown-exporter.ts` | Pure AST→Markdown render | Adds YAML frontmatter |
| **LaTeX** | `latex-exporter.ts` | Pure AST→LaTeX render | Arabic: XeLaTeX+polyglossia; English: pdfLaTeX |
| **Typst** | `typst-exporter.ts` | Pure AST→Typst render | RTL-aware with `#set text(dir: rtl)` |

All exporters are registered in `App.svelte`'s `init()` via `registerExporter(...)`. A future UI would offer an "Export" menu listing all registered exporters, allowing the user to pick a format.

### Pipeline integration

```
             ┌─► renderMarkdown() → HTML (current preview)
             │
Markdown ────┤
             │
             └─► createDocument() → DocumentModel ──► [registered exporters]
```

### Manuscript Compiler (`src/lib/publishing/manuscript.ts`)

The manuscript compiler merges multiple notes (chapters) into a unified `DocumentModel` AST with generated front matter and back matter.

#### Compilation Pipeline

```
Manuscript definition
  { title, author, chapters: [{ noteId, title, type }, ...] }
    │
    ▼
compileManuscript(manuscript, bibEntries?)
    │
    ├─► For each chapter: readNote(noteId) → parseDocument(markdown)
    │     └─► Extract figures, tables, equations, headings, citations
    │
    ├─► Global numbering
    │     └─► Sequential fig/tbl/eq numbers across all chapters
    │
    ├─► Generate front matter
    │     ├─► Title page (AST blocks)
    │     ├─► Table of Contents (grouped by chapter, max 3 levels)
    │     ├─► List of Figures
    │     └─► List of Tables
    │
    ├─► Merge chapter blocks
    │     └─► Each chapter preceded by thematic break + chapter heading
    │
    ├─► Append bibliography
    │     └─► Collect all [@key] citations, format from bibEntries
    │
    └─► Return CompilationResult
```

#### Key Types

| Type | Fields | Purpose |
|------|--------|---------|
| `Manuscript` | `id, title, author?, date?, lang?, direction?, chapters[]` | Book-level metadata and chapter list |
| `ManuscriptChapter` | `id, noteId, title, type, number?` | A single chapter referencing a note by ID |
| `TocEntry` | `level, text, chapterId?, id?` | Heading extracted for TOC |
| `ListEntry` | `id, number, caption, chapterId?, chapterTitle?` | Figure/table/equation listing |
| `CompilationResult` | `manuscript, document, toc, figureList, tableList, equationList, citations` | Full compilation output |

`ManuscriptChapter.type` can be `'preface' | 'chapter' | 'appendix' | 'bibliography'`. Bibliography chapters are appended after the auto-generated bibliography section.

#### CompilationResult.document

The unified `DocumentModel` contains blocks in this order:

```
1. Title page (H1 title + author + date + ---)
2. Table of Contents (H1 "المحتويات" + heading entries)
3. ---
4. List of Figures (H1 "قائمة الأشكال" + entries)
5. ---
6. List of Tables (H1 "قائمة الجداول" + entries)
7. ---
8. [Chapter 1 blocks]  (with H1 if no H1 in source)
9. ---
10. [Chapter 2 blocks]
11. ...
12. ---
13. Bibliography (H1 "المراجع" / "Bibliography" + formatted entries)
14. [Explicit bibliography chapter blocks, if any]
```

#### Front matter localization

All headings and labels respect the manuscript's `direction` / `lang` setting:
- `lang === 'ar'` or `direction === 'rtl'` → Arabic labels (المحتويات، قائمة الأشكال، قائمة الجداول، المراجع، الفصل)
- Otherwise → English labels (Table of Contents, List of Figures, List of Tables, Bibliography, Chapter)

---

## Preview Pipeline

`src/components/Preview.svelte`

```
noteContent store ─┐
bibEntries store ──┤
hierarchy store ───┤
                   ▼
renderMarkdown(content, entries, digitStyle) ← markdown.ts
   │                               (citations replaced, bibliography appended)
   ▼
renderWikiLinks(html, $hierarchy)  ← backlinks.ts
   │                               (convert [[Name]] → <a data-note-id="...">)
   ▼
resolveAssets(html)              ← replace src="assets/..." with convertFileSrc()
   │                              (Tauri asset protocol URL)
   ▼
{@html html}                     ← innerHTML with on:click wiki link handler
   │
   ▼
getLastCitationResult()          ← read module-level usedKeys/missingKeys
   │                              → update citedKeys / missingCitationKeys stores
```

### Click handling
- Wiki links rendered as `<a class="wiki-link-resolved" data-note-id="ID">`
- Click handler uses `closest('a.wiki-link-resolved')` to find the link
- Sets `$activeNoteId` → navigates to target note
- Broken links render as `<span class="wiki-link-missing">` (no click action)

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
Default: `{appDataDir}/scientific-writer/workspace/` (resolved by
`tauri::path::app_data_dir()`). Other folders can be opened through the native
folder picker or the recent-workspaces list; the backend asks for confirmation
before trusting a new root.

### File layout
```
workspace/
├── hierarchy.json      # Note tree as TreeNode[] JSON
├── references.bib      # BibTeX reference database (optional)
├── {note-id}.md        # Individual note files
├── .backups/           # Auto-recovery snapshots (git-ignored)
└── assets/
    └── {image-files}   # Uploaded images (validated basename, atomic write)
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
1. `initWorkspace()` asks the backend to open the saved path (`open_workspace`)
   or falls back to `get_workspace_dir()`; both return a trusted root.
2. Tries to read `hierarchy.json`
3. If not found: creates default hierarchy (2 folders, 5 notes with sample content including wiki link examples)
4. Writes default files via `write_text_file`
5. Returns `TreeNode[]` → set into `hierarchy` store
6. `ensureBibliography()` reads `references.bib` from workspace;
   - If missing: writes a template `.bib` file with commented-out examples
7. `parseBibTeX()` → `BibEntry[]` → set into `bibEntries` store
8. `buildBacklinksIndex()` scans all notes → `backlinksIndex` store

### Save flow
- Edits go to `noteSaver.schedule(id, content)` — a per-note debounced queue
  (500 ms) that writes the latest content for the correct note.
- `flush()` runs before note/workspace switches and on window close
  (`onCloseRequested` in `App.svelte`), so the last keystrokes reach disk.
- Save failures are surfaced as a toast; the note stays dirty for retry.
- `write_text_file` and asset writes are atomic (temp file + rename).
- Hierarchy changes (rename, delete, add, drag) → `saveHierarchy(nodes)` writes
  `hierarchy.json`
- References editor (`__references__` virtual note) → saves to `references.bib`
  via the same queue (`REFERENCES_ID`).

### References editor
- A virtual note with ID `__references__` displays the raw `references.bib` file in the editor
- Accessed via a "المراجع" button in the left sidebar (below HierarchyTree)
- Edits are saved back to `references.bib` and re-parsed into `bibEntries` store

### Note file naming
- Files stored as `{id}.md` where `id` is from `createId()` (timestamp + counter)
- Display name is `node.name` in the hierarchy (not the filename)

---

## Bibliography & Citations

### Architecture

Core logic in `src/lib/bibliography.ts`. Arabic-specific formatters in `src/lib/citation-arabic.ts`. Formatters are isolated functions designed to be swappable with a CSL-based implementation in the future.

### BibTeX Parser

- Parses standard `.bib` files: `@article{key, author = {...}, ...}`
- Supports brace-delimited `{value}` and quote-delimited `"value"` fields
- Handles nested braces in values (e.g., `{The {B}ook Title}`)
- Skips `@string`, `@preamble`, `@comment` directives
- Returns `BibEntry[]` with `{ key, type, fields }` structure

### Entry type support

| Type | Fields | Formatter |
|------|--------|-----------|
| `@article` | author, title, year, journal, volume, number, pages | Standard |
| `@book` | author, title, year, publisher, edition | Standard |
| `@inproceedings`/`@incollection` | author, title, year, booktitle, publisher, pages | Standard |
| `@phdthesis`/`@mastersthesis` | author, title, year, school | Standard |
| `@manuscript` | author, title, year, library/siglum, shelfmark, folio, side | Arabic (citation-arabic.ts) |
| `@tabaqat` | author, title, tabaqa/generation, death/year, pages/page | Arabic (citation-arabic.ts) |

### Citation Syntax

| Input                                    | Output                                       |
|------------------------------------------|----------------------------------------------|
| `[@smith2024]`                           | `(Smith, 2024)`                              |
| `[@smith2024; @jones2023]`               | `(Smith, 2024; Jones, 2023)`                 |
| `[@arabic2024]` (Arabic entry)           | `(محمد، ٢٠٢٤)`                               |
| `[@ms:ms123]`                            | `(دار الكتب ١٢٣، ورقة ٥أ، ١٨٥٠)`             |
| `[@tab:tab123]`                          | `(الطبقة ٣، ت ٢٣١، ص ٤٥)`                     |
| `[@unknown]` (missing key)              | `(?unknown?)`                                |

### Author formatting rules

- 1 author → `Last`
- 2 authors → `Last1 & Last2` (Arabic: `Last1 وLast2`)
- 3+ authors → `Last1 et al.` (Arabic: `Last1 وآخرون`)
- Language detection: scans `author` + `title` fields for Arabic Unicode characters

### Arabic CSL strings (`citation-arabic.ts`)

| Key | Arabic | Usage |
|-----|--------|-------|
| `page`/`pages` | ص | Page number prefix |
| `volume` | جـ | Volume prefix |
| `number` | ع | Issue number prefix |
| `edition` | ط | Edition prefix |
| `publisher` | الناشر | Publisher label |
| `journal` | مجلة | Journal label |
| `in` | في | "In" for proceedings |

### Manuscript formatting
- Signature: `{library siglum} {shelfmark}، ورقة {folio}{side}`
- Example: `دار الكتب ١٢٣، ورقة ٥أ`

### Ṭabaqāt formatting
- Pattern: `{author}، الطبقة {N}، ت {death}، ص {page}`
- Example: `محمد بن سعد، الطبقة ٣، ت ٢٣١، ص ٤٥`

### Bibliography generation

- Appended automatically after rendered content (behind `<hr>`)
- Heading: `المراجع` if any entry contains Arabic text, otherwise `References`
- Entries numbered in order of first appearance (`[1]`, `[2]`, ...)
- Arabic entries use Arabic ordinals and formatting (`مجلة`, `جـ`, `ع`, `ص`, `ط`, `الناشر`, `في`, `رسالة دكتوراه`, `رسالة ماجستير`)
- Titles wrapped in `«guillemets»` for Arabic entries, standard quotes for English

### Missing citation detection

- Keys cited via `[@key]` that don't exist in `references.bib` → tracked in `missingCitationKeys` store
- In-text: shown as `(?key?)` inline
- Bibliography: warning box with `Missing references` / `المراجع غير الموجودة` listing all missing keys

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
   │  │    └─ dispatches to citation-arabic.ts for Arabic/manuscript/tabaqat entries
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

## Typography & Justification

### Kashida engine (`src/lib/kashida.ts`)

- Optional tatweel/kashida justification applied after rendering
- `applyKashida(previewEl, config)` inserts `&#x0640;` characters into Arabic text nodes to reach a target fill ratio
- Toggle via `kashidaConfig.enabled` store
- `clearKashida(previewEl)` removes inserted kashidas for re-application

### Font settings

- Custom font family, weight, optical size, width via `fontSettings` store
- Supports variable-font axes: `wght`, `opsz`, `wdth`/`HEXP`
- Ligature toggles via `ligatureSettings` store (`rlig`, `liga`, `dlig` OpenType features)
- Applied as CSS `font-variation-settings` and `font-feature-settings` on the preview div

---

## History / Undo-Redo (Editor.svelte)

- `history: string[]` — up to 200 editor snapshots
- `historyIndex` — current position in history
- `pushHistory()` called before every editor mutation
- Ctrl+Z/Ctrl+Y wired to undo/redo
- `ignoreNextInput` flag prevents duplicate history entries on programmatic `setValue()` calls

---

## Keyboard Shortcuts (Editor.svelte)

| Shortcut | Action |
|----------|--------|
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+S | Save |
| Ctrl+B | Bold (`**text**`) |
| Ctrl+I | Italic (`*text*`) |
| Ctrl+T | Insert table dialog |
| Ctrl+L | Insert link or wrap selection |
| Ctrl+Q | Blockquote (`> `) |
| Ctrl+1–6 | Heading H1–H6 |

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
- Academic blocks: fenced code block with `::: theorem`, `::: proof`, etc.
- Wiki links: `[[Note Name]]` syntax, rendered as clickable cross-document links
- New notes via the editor toolbar or HierarchyTree context menu
