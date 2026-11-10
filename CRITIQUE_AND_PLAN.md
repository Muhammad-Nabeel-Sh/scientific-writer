# الكاتب العلمي — Critique & Roadmap

> Review date: 2026-11-10 · Reviewed at commit `749c781` (+ uncommitted `TableEditor` work)
> Scope: the whole repo — frontend (`src/`), backend (`src-tauri/`), data (`docs/`), docs, and the math pipeline.
> Audience: the project owner, Claude (complex/architectural tasks) and opencode (well-scoped tasks).

---

## 0. How to read this document

- **Part A** is the critique, ranked by severity. Every claim names a file and line so it can be checked.
- **Part B** is the design for the feature you are planning: **custom LaTeX/KaTeX symbols that neither supports today**, including Arabic math notation.
- **Part C** is the phased plan. Each task is tagged:
  - **[OC]** — for **opencode**: mechanical, well-bounded, clear acceptance criteria.
  - **[CL]** — for **Claude**: cross-cutting design, security, parser/pipeline work, or anything where a wrong call is expensive.
- **Part D** is a hand-off brief for opencode (conventions, commands, "don't touch" list).

Severity legend: 🔴 critical (security / data loss / broken in production) · 🟠 major (wrong output, architectural debt that blocks the roadmap) · 🟡 minor (quality, polish).

---

## Part A — Critique

### A.1 What is genuinely good

Credit first, because the plan should preserve these:

- **The vision is right and rare.** An Arabic-first scholarly editor that treats Quran/Hadith citation, tafqīt, Hijri dates, classical layouts (matn/sharḥ/ḥāshiyah), kashida and Arabic-Indic digits as first-class is a real gap in the market. Nothing mainstream (Word, Overleaf, Obsidian, Typora) does this well.
- **Breadth of Arabic-specific features** in a small codebase (~16k lines): 10 lexicons, Hunspell spellcheck, diacritic palette, tafqīt, Hijri↔Gregorian, poetry hemistich layout, Arabic citation strings, manuscript and ṭabaqāt citation formats.
- **A publishing AST exists** (`src/lib/publishing/ast.ts`) with an exporter registry. The *idea* of one intermediate model feeding LaTeX/Typst/DOCX/Markdown is the correct architecture.
- **Typecheck is clean**: `npm run check` → 0 errors, 7 warnings (all `a11y_autofocus`).
- **Templates are extensible** via `registerTemplate()`.

The problems below are mostly about *foundations*: the app grew features faster than its core (security, parsing, persistence, packaging) was hardened. Adding a math-symbol system on top of the current pipeline would multiply those problems, so Part C fixes the foundations first.

---

### A.2 🔴 Security: any note can take over the machine

This is the single most important finding.

| Fact | Where |
|---|---|
| markdown-it runs with `html: true` — raw HTML in a note is passed straight to the DOM | `src/lib/markdown.ts:44` |
| Rendered HTML is injected with `{@html}` with **no sanitizer** | `src/components/Preview.svelte:97` (also `SearchDialog.svelte:185`, `EquationDialog.svelte:97,126`, `CodeDialog.svelte:191`) |
| CSP is disabled | `src-tauri/tauri.conf.json` → `"csp": null` |
| Asset protocol scope is the whole disk | `tauri.conf.json` → `"assetProtocol": { "scope": ["**"] }` |
| Every FS command takes an **arbitrary absolute path** and is not confined to the workspace | `src-tauri/src/lib.rs` → `read_text_file`, `read_binary_file`, `write_text_file`, `remove_file`, `rename_file`, `copy_file`, `create_dir` |
| `copy_file_to_assets` joins an unvalidated `file_name` (`../../x` escapes `assets/`) | `lib.rs:17-24` |
| `export_pandoc` interpolates an unvalidated `format` into a path | `lib.rs:102+` |

**Attack:** a user opens a shared note / sample project / pasted text containing
`<img src=x onerror="window.__TAURI_INTERNALS__.invoke('write_text_file',{path:'C:/Users/…/Startup/x.bat',content:'…'})">`.
The preview renders it, the handler runs, and the backend writes anywhere on disk. Reading `~/.ssh` or browser profiles works the same way via `read_text_file`. For an app whose whole point is exchanging scholarly texts, this is a real threat, not a theoretical one.

**Fix direction (Phase 1):** sanitize (DOMPurify with an allowlist that keeps KaTeX/MathML/SVG output), set a strict CSP, scope the asset protocol to the workspace, and make every Rust FS command resolve paths *relative to a registered workspace root* and reject anything that canonicalizes outside it.

---

### A.3 🔴 Data integrity

1. **Undo history is shared across all notes.** `history`/`historyIndex` live in `Editor.svelte:85-86` and are never reset when `activeNoteId` changes. Switch from note A to note B, press Ctrl+Z → note B's textarea is filled with note A's text, the input event fires, and the debounced save **writes A's content into B's file**. This is silent data loss.
2. **An emptied note can never be saved.** `Editor.svelte:92` — `if (!$activeNoteId || !content.trim()) return;`. Delete everything in a note and the old content stays on disk; reopening resurrects it.
3. **Non-atomic writes.** `write_text_file` uses `fs::write` directly (`lib.rs`). A crash or power cut mid-write truncates the note. Use write-to-temp + `rename` (atomic on NTFS for same-volume).
4. **Errors are swallowed.** `catch { /* ignore */ }` in the save path (`Editor.svelte`) and many places in `src/lib/fs.ts`. The user is never told a save failed.
5. **Double debounce.** `handleInput` sets a 300 ms `setTimeout` that calls a 500 ms `debounce` → ~800 ms effective, and two timers to reason about.
6. **Images as base64 data URLs** (per `PHASE_I_SUMMARY.md`) bloat `.md` files; the newer Assets panel fixes this for new images but there's no migration.

---

### A.4 🔴 Packaging: features that cannot work in a built app

1. **Hadith is dev-only.** `read_hadith_book` reads from `project_root()` = `env!("CARGO_MANIFEST_DIR")/..` (`lib.rs:186`). That is the *compile machine's* source path, baked in at build time. On any user's machine the path doesn't exist. The hadith JSON is also **not listed in `bundle.resources`**.
2. **Fonts load from Google Fonts CDN** (`src/app.html:8-10`). A desktop writing app must work offline; with no network the Arabic UI falls back to system fonts and KaTeX/Arabic metrics change. Only `OldAnticBold.ttf` is bundled.
3. **Pandoc is not bundled**; the code looks for `pandoc.exe` (Windows-only name) next to the exe or on `PATH`.
4. **LaTeX export hard-codes `Traditional Arabic`** — a Windows-only font — so `.tex` output fails on macOS/Linux/Overleaf.
5. **Repository weight & hygiene.** `docs/` (147 MB, 644 tracked files) is in git; `src-tauri/db/` (166 MB) is git-ignored so a fresh clone **cannot build** the dictionary feature and nothing documents where to get it. `.vs/` (Visual Studio caches, including `slnx.sqlite`) is committed.

---

### A.5 🟠 Architecture

1. **Two independent Markdown parsers.**
   - Preview: markdown-it + plugins (`src/lib/markdown.ts`).
   - Export: a hand-written line parser (`src/lib/publishing/document.ts`, 643 lines) with its own regexes (e.g. inline math `/\$(.+?)\$/`, math block only when `$$` is alone on a line).
   They *will* disagree (they already do: preview accepts `$$x$$` inline-display, the exporter doesn't; footnotes, containers, gloss lines are parsed twice with different rules). Every new syntax — including custom math symbols — must be implemented twice. **This is the main blocker for the math roadmap.**
2. **Regex pre/post-processing around markdown-it instead of plugins.** `renderMarkdown()` (`markdown.ts:268+`):
   - inserts a blank line after **every** line (`markdown.ts:293`) to emulate hard breaks — this turns every list into a "loose" list, breaks lazy blockquote continuation and multi-line list items, and makes `breaks: true` redundant;
   - converts digits by regex on raw lines (`markdown.ts:288`) — see A.6;
   - extracts table captions, equation labels, and then patches the *HTML string* with regexes to add `dir`, captions, equation numbers (`markdown.ts:363-420`). The equation-number regex pairs the *n*-th `katex-block` with the *n*-th `$$` found by a different regex — any mismatch (a `$$` inside inline code, a `$$` that fails to parse) shifts every number after it.
3. **Module-level mutable state** in `markdown.ts` (`figCounter`, `equationInfos`, `lastUsedKeys`) and `blocks.ts` (`counters`, `blockInfos`, `currentLang`). Rendering is therefore non-reentrant: the EquationDialog, gallery, search and preview cannot safely render concurrently, and results are read back through side-channel getters (`getLastCitationResult()`).
4. **`console.warn` is monkey-patched during every render** (`markdown.ts:356-361`) to hide KaTeX "character metrics" warnings. Those warnings are real signals (see A.6). If `md.render` throws, the restore line is skipped and `console.warn` stays patched forever.
5. **Full re-render on every keystroke.** `Preview.svelte` re-runs `renderMarkdown` + wiki links + asset resolution + kashida (a DOM-mutating pass) on each `noteContent` change. Fine for 2 pages, unusable for a 300-page thesis.
6. **Synchronous Tauri commands run on the main thread.** All commands in `lib.rs` are plain `fn` → in Tauri v2 they block the event loop. Reading a 59 MB hadith set, running Pandoc, or `LIKE '%q%'` across 10 dictionary tables freezes the window.
7. **`Editor.svelte` is 1,459 lines** with ~20 dialog booleans and direct textarea DOM mutation. It's the hardest file to change and the most changed.
8. **A plain `<textarea>`** is the editor: no syntax highlighting, no math-aware autocomplete, no per-line bidi control, no decorations (spelling squiggles, inline math preview), custom undo stack. Most of the roadmap (symbol autocomplete, inline previews) needs a real editor component.
9. **Two KaTeX versions ship.** `katex@0.17.0` is a direct dependency (used by `EquationDialog`, `KatexGallery`, and its CSS is imported), while `@traptitech/markdown-it-katex` bundles its own `katex@0.16.47` for the preview. Preview HTML from 0.16 is styled with 0.17 CSS, and anything you register (macros, symbols) on one instance does not exist on the other. Custom-symbol work **must** start by collapsing this to one KaTeX instance.

---

### A.6 🟠 Math pipeline specifics

1. **Digits inside display math get converted to Arabic-Indic.** `convertArabicDigits` protects `$$…$$` only when both delimiters are on the *same line*. In a normal multi-line block the inner lines are converted whenever digit style is `eastern`, or `auto` and the line contains any Arabic (e.g. `\text{السرعة} = 2t`). Reproduced:
   ```
   $$\ns_1^2 + x_2\n$$  →  s_١^٢ + x_٢   (KaTeX: "Unrecognized Unicode character ١", "No character metrics")
   ```
   These are exactly the warnings `markdown.ts:356` silences. Digit shaping inside math must be a **math-renderer decision** (a KaTeX macro / font feature), not a text regex.
2. **No shared KaTeX configuration.** Preview, EquationDialog and KatexGallery each call KaTeX with different options; there's no `macros`, no `trust` policy, no `strict` policy in one place. User-defined `\newcommand`s don't exist.
3. **No RTL math.** CSS forces `.katex { direction: ltr }` (`app.css:166`). That's correct for Western notation, but the app has no path for **Arabic mathematical notation** (right-to-left expressions, Arabic-letter variables س ص ع, mirrored ∑ √ and arrows, function names جا جتا ظا لو نها) — which is the natural ambition for "genuine Arabic engineering texts".
4. **Equation numbers are always Western `(n)`** and always on the right regardless of document direction.
5. **LaTeX exporter math is unusable for real documents** (`src/lib/publishing/latex-exporter.ts`):
   - no `amsmath`/`amssymb`/`mathtools`/`unicode-math` in the preamble → `align`, `\mathbb`, `\text`, `\dfrac`, `\boldsymbol`… fail to compile;
   - `\label{}` is never emitted, so `[ref:eq:…]` becomes a literal `(label)` instead of `\eqref`;
   - `escapeLatex` (`:5-6`) maps `\` → `\\` (a line break!), `~` → `\~` and `^` → `\^` (accent commands, which then eat the next character). Correct are `\textbackslash{}`, `\textasciitilde{}`, `\textasciicircum{}`;
   - `numerals=maghrib` hard-coded; RTL documents with English blocks never switch language (`\textenglish{}` / `\begin{english}`).
6. **Typst exporter math is invalid.** It passes LaTeX source straight into Typst math (`typst-exporter.ts:19, 64-65`), but Typst math has its own syntax (`frac(a, b)`, not `\frac{a}{b}`). The block form `$${value} $ (n)$` is not valid Typst at all. Use the `mitex` package or a converter.
7. **DOCX export** goes Markdown → Pandoc with no options: no `--reference-doc` (no Arabic styles), no `-M lang=ar -M dir=rtl`, no macro definitions (Pandoc can expand `\newcommand` in Markdown via its `latex_macros` extension — not used), and the app's own syntax (`[ref:eq:…]`, `:::` blocks, `@ms:` citations, poetry fences) reaches Pandoc unconverted.

---

### A.7 🟠 Arabic-language correctness

1. **Spellcheck splits words at every ḥaraka.** `lib.rs:396` splits on `!c.is_alphanumeric()`. Arabic diacritics (U+064B–U+0652, U+0670) are combining marks (`Mn`), not alphanumeric, so `كَتَبَ` becomes `ك`, `ت`, `ب` fragments. Any vocalised text — Quran, poetry, classical prose, the app's core audience — produces garbage results. Must strip tashkeel (and tatweel U+0640) before checking and tokenise on word boundaries, keeping offsets for highlighting.
2. **Spellcheck clones the entire Hunspell dictionary on every call** (`lib.rs:390`, `.clone()`). That's a multi-MB copy per check; hold the lock (or an `Arc`) instead.
3. **`word.len() < 2`** counts *bytes* (Arabic letters are 2 bytes in UTF-8), so it filters nothing for Arabic.
4. **Dictionary search** opens a new SQLite connection per call and runs `LIKE '%q%'` (full scans) on each of 10 tables (`lib.rs:250`), unnormalised (hamza/alef/ya variants and tashkeel aren't folded). Needs an FTS5 index over a normalised column, built once.
5. **Docs say 11 dictionaries, code lists 10** (`DICTS` in `lib.rs`). AGENTS.md says 16 commands; there are 19 (including leftover `greet` and `debug_dictionary_path`).
6. **Direction detection is "any Arabic character in the block"** (`markdown.ts` list/table post-processing). A mostly-English list item containing one Arabic word flips the whole list to RTL. Use first-strong-character (what `dir="auto"` does) consistently.
7. **Figure/table label language** is guessed per caption (`hasArabic`), so an Arabic thesis with an untitled figure says "Figure 3". The label language should come from the *document* language setting.

---

### A.8 🟡 Quality, process and docs

- **No tests at all.** Tafqīt, Hijri conversion, Arabic normalisation, digit conversion, BibTeX parsing, exporters — all pure functions, all untested. This is the cheapest high-value fix and ideal opencode work.
- **README.md is the Tauri template boilerplate.**
- `ARCHITECTURE.md` (43 KB) and `PHASE_I_SUMMARY.md` partially contradict the code (e.g. "11 lexicons", component paths); "Arabic Scolarly Writing.md" (typo in filename) is the most accurate status list.
- `Examples/` (untracked) contains real workspaces with UUID filenames — good as fixtures, but they should be cleaned and committed under `tests/fixtures/` or `examples/` with readable names.
- 7 `a11y_autofocus` warnings; dialogs lack focus trapping and `Esc` handling consistency.
- `tauri.conf.json`: `"fullscreen": true` on launch is hostile on multi-monitor setups; `identifier` `com.scientific.writer` and `authors = ["you"]` are template leftovers.
- Arabic UI strings are hard-coded across 27 components; there is no i18n layer, which makes a future English UI (for non-Arabic co-authors / reviewers) expensive.
- `@umalqura/core@0.0.7` is an unmaintained pre-1.0 package; pin and wrap it (already wrapped in `hijri.ts`, good) and add tests so a swap is safe.

---

## Part B — Design: custom math symbols & Arabic math

### B.1 Goal

Let the author use symbols that **neither KaTeX nor standard LaTeX provide out of the box** — e.g. Arabic mathematical alphabet letters (Unicode block **U+1EE00–U+1EEFF**, "Arabic Mathematical Alphabetic Symbols"), Arabic function names (جا، جتا، ظا، قا، لو، نها، مجـ), mirrored operators for RTL notation, engineering/units symbols, classical-text sigla, or the author's own glyphs — **with one definition that works identically in preview, EquationDialog, gallery, LaTeX, Typst and DOCX.**

### B.2 Constraints that shape the design

- **KaTeX can only lay out glyphs it has metrics for.** Unknown Unicode in math mode produces the `unknownSymbol` / "No character metrics" warnings and approximate boxes. KaTeX's own fonts have no Arabic.
- KaTeX exposes **public** extension points: `macros` (expansion-only) and `\htmlClass`/`\htmlStyle`/`\htmlData` (gated by `trust`). It also has **internal, unstable** ones: `katex.__defineSymbol`, `katex.__defineMacro`, `katex.__setFontMetrics`. Internals may break on any minor upgrade → only use them behind a pinned version and a test.
- **The WebView is Chromium (WebView2)**, which implements **MathML Core**, including `dir="rtl"` on `<math>` and OpenType MATH tables. This is the realistic path to true RTL math rendering without writing a layout engine.
- **LaTeX side:** with XeLaTeX/LuaLaTeX + `unicode-math`, any Unicode symbol present in the chosen math font can be used directly or via `\newcommand`. RTL Arabic math in LaTeX is niche — candidates are the `bidi` package's RTL-math support (XeLaTeX) and LuaTeX-based approaches; **this needs a spike before committing** (task M7).
- **Pandoc (DOCX):** reads TeX math and writes OMML; it honours `\newcommand` definitions when the `latex_macros` extension is on. So exporting the registry as macro definitions makes DOCX work for anything expressible in standard TeX; true custom glyphs need a Unicode fallback.

### B.3 The symbol registry (single source of truth)

New module `src/lib/math/`:

```
src/lib/math/
├── katex-instance.ts   # THE only place katex is imported; shared options, macros, trust policy
├── registry.ts         # defineSymbol(), getSymbols(), search; validation
├── symbols/
│   ├── arabic-alphabet.ts   # U+1EE00 block: \arA, \arB … (mathematical Arabic letters)
│   ├── arabic-functions.ts  # \jaa (جا), \jataa (جتا), \nihaya (نها), \lugh (لو) …
│   ├── engineering.ts       # units, phasors, etc.
│   └── user.ts              # loaded from workspace `math-symbols.json`
├── to-latex.ts         # registry → preamble (\usepackage + \newcommand)
├── to-typst.ts         # registry → mitex macro defs / Typst `#let`
└── to-pandoc.ts        # registry → `\newcommand` header for latex_macros
```

One symbol definition (exact shape — implementers follow this):

```ts
export interface MathSymbol {
  name: string;                 // macro without backslash, e.g. "jaa"
  category: 'arabic-letter' | 'arabic-function' | 'operator' | 'relation' | 'arrow' | 'unit' | 'misc';
  labelAr: string;              // shown in gallery, e.g. "جيب الزاوية"
  keywords: string[];           // search terms (Arabic + English), normalised with normalizeArabic()
  unicode?: string;             // e.g. "\u{1EE00}" — used by MathML/Typst/DOCX fallback
  arity?: 0 | 1 | 2;            // number of arguments
  katex:                        // how to render in KaTeX
    | { kind: 'macro'; body: string }                 // pure expansion, e.g. "\\operatorname{\\text{جا}}"
    | { kind: 'glyph'; char: string; font: string; atom: 'mathord' | 'mathop' | 'mathrel' | 'mathbin' };
  latex: { body: string; packages?: string[] };      // e.g. { body: "\\operatorname{\\textarabic{جا}}" }
  typst?: string;               // optional override; default derived from unicode
  mirrorInRtl?: boolean;        // operator should be mirrored in RTL math (∑, √, →)
}
```

- `kind: 'macro'` covers most needs (function names, compositions of existing symbols) using only the **public** `macros` option.
- `kind: 'glyph'` covers true new glyphs: rendered as `\htmlClass{sw-sym sw-font-<font>}{\text{<char>}}` wrapped in the right atom (`\mathrel{…}` etc.) so spacing is correct; CSS applies a **bundled** math-capable font (candidates to evaluate: *Noto Sans Math*, *XITS Math*, *Amiri* for Arabic text — coverage of U+1EE00 must be verified per font). `trust` is enabled **only** for `\htmlClass` with classes starting `sw-`.
- User symbols live in `{workspace}/math-symbols.json` so a book carries its own notation with it; validated on load (name regex `^[a-zA-Z]+$`, no collision with built-in KaTeX macros unless `override: true`).

### B.4 Arabic RTL math (staged, because it is research)

1. **Stage 1 — Arabic inside LTR math (cheap, safe):** Arabic function names and Arabic-letter variables via the registry, rendered LTR. Fixes 80% of real-world Arabic engineering texts, which mix Arabic labels into Western-layout formulas.
2. **Stage 2 — RTL math via MathML (spike first):** a per-equation or per-document switch (`$$[rtl] … $$` or document front-matter `math-dir: rtl`) renders with KaTeX `output: 'mathml'`, sets `dir="rtl"` on `<math>`, and relies on Chromium's MathML Core + a math font with RTL mirroring (`rtlm`) support. Fallback for operators without font support: CSS `transform: scaleX(-1)` on symbols flagged `mirrorInRtl`. Acceptance is visual — needs a reference page of ~20 formulas from an Arabic school textbook to compare against.
3. **Stage 3 — RTL math in export:** LaTeX path chosen by the M7 spike; Typst has native RTL text but math layout is LTR — document as limitation if not solvable.

### B.5 Editor integration

- **Gallery** (`KatexGallery.svelte`, 703 lines of hard-coded arrays) becomes data-driven from the registry + KaTeX's own symbol list, searchable in Arabic (`keywords` + `normalizeArabic`).
- **Autocomplete**: typing `\` inside `$…$` offers registry symbols with live preview (requires the CodeMirror migration, Phase 6; a lightweight textarea popup is possible earlier).
- **Unknown-macro diagnostics**: instead of silencing KaTeX warnings, collect them per equation and show a gutter/inline marker ("الرمز \foo غير معرَّف — أضِفه إلى الرموز المخصصة؟").

---

## Part C — Phased plan

Ordering rule: **safety → data integrity → one pipeline → math system → exports → editor/perf → polish.** Phases 0–1 are prerequisites for everything; Phase 3 (math) depends on Phase 2 (single pipeline) and task P0.3 (tests).

Each task lists: owner, files, what "done" means. opencode tasks are written to be executable without further design.

### Phase 0 — Hygiene & test harness (mostly opencode, do first)

| ID | Owner | Task | Files | Done when |
|---|---|---|---|---|
| P0.1 | [OC] | Untrack `.vs/`; add `.vs/`, `src-tauri/target/`, `*.sqlite-journal`, `.temp_export.*` to `.gitignore` | `.gitignore` | `git ls-files .vs` is empty |
| P0.2 | [OC] | Replace template README with: what the app is, prerequisites (Rust msvc, Node, Pandoc), **where to obtain `src-tauri/db/dicts.sqlite`**, dev commands | `README.md` | A fresh clone can follow it to `npm run tauri dev` |
| P0.3 | [OC] | Add **Vitest** (`npm run test`), config for `$lib` alias, one smoke test; add `test` to AGENTS.md command table | `package.json`, `vitest.config.ts`, `src/lib/__tests__/smoke.test.ts`, `AGENTS.md` | `npm run test` passes |
| P0.4 | [OC] | Unit tests for pure modules (no behaviour change): `tafqit.ts`, `hijri.ts`, `search.ts#normalizeArabic`, `bibliography.ts#parseBibTeX`, `citation-arabic.ts`, `stats.ts`, `kashida.ts` (string-level parts). ≥5 cases each, include edge cases (0, negatives, fractions; 1 Muharram; hamza variants; empty BibTeX) | `src/lib/__tests__/*.test.ts` | All pass; any *bug* found is written up as a failing `it.todo` + note, not silently fixed |
| P0.5 | [OC] | Golden tests for `renderMarkdown` using `Examples/Sample 1` notes as fixtures: snapshot HTML. Move fixtures to `tests/fixtures/` with readable names | `tests/fixtures/`, `src/lib/__tests__/markdown.snap.test.ts` | Snapshots committed; this is the safety net for Phase 2 |
| P0.6 | [OC] | Remove `greet` and `debug_dictionary_path` commands (and frontend calls, if any); fix command/dictionary counts in AGENTS.md and ARCHITECTURE.md; rename "Arabic Scolarly Writing.md" → `docs/FEATURE_STATUS.md` | `lib.rs`, docs | `cargo check` + `npm run check` pass |
| P0.7 | [OC] | Bundle fonts locally (Amiri, Cairo, Noto Sans Arabic, Readex Pro — all OFL) under `static/fonts/`, replace Google Fonts `<link>` with `@font-face` in `app.css` | `src/app.html`, `src/app.css`, `static/fonts/` | App renders identically with network disabled |
| P0.8 | [OC] | Fix the 7 `a11y_autofocus` warnings (focus in `onMount` instead) | dialogs listed by `npm run check` | `npm run check` → 0 warnings |
| P0.9 | [OC] | `tauri.conf.json`: `fullscreen:false` + `maximized:true`; fix `authors`, `description` in `Cargo.toml` | config | — |

### Phase 1 — Security & data integrity (Claude designs, opencode assists)

| ID | Owner | Task | Done when |
|---|---|---|---|
| P1.1 ✅ | [CL] | **Workspace-scoped FS layer in Rust.** Introduce `WorkspaceState { roots: Mutex<Vec<PathBuf>> }`, a `register_workspace(path)` command (only callable with a path the user picked via dialog or the default dir), and a `resolve_in_workspace(rel: &str) -> Result<PathBuf>` that canonicalises and rejects escapes. All file commands take **workspace-relative** paths. Update `src/lib/fs.ts` accordingly. | Rust unit tests: `../` escapes, absolute paths, symlinks, `assets/../../x` all rejected |
| P1.2 ✅ | [CL] | **Sanitise rendered HTML.** Add DOMPurify; one `sanitize(html)` in `src/lib/sanitize.ts` with an allowlist for KaTeX HTML + MathML + the app's classes/`data-*`; apply at every `{@html}` site. Decide whether raw HTML in notes stays (`html: true`) — recommendation: keep it but sanitised. | Test: `<img onerror>`, `<script>`, `javascript:` links, `<iframe>` stripped; KaTeX snapshot tests from P0.5 unchanged |
| P1.3 ✅ | [CL] | **CSP + asset scope.** Strict CSP (`default-src 'self'; img-src 'self' asset: data:; style-src 'self' 'unsafe-inline'; font-src 'self'`), asset protocol scope limited to registered workspaces (dynamic scope via `tauri::scope`). | App works; an injected inline `<script>` is blocked (verified in devtools) |
| P1.4 | [OC] | Validate `file_name` in `copy_file_to_assets` (no separators, no `..`, strip to basename) and whitelist `format` in `export_pandoc` (`docx`, `odt`, `epub`, `html`). Rust tests. | Tests pass |
| P1.5 ✅ | [CL] | **Atomic writes**: `write_text_file` writes `path.tmp` then `fs::rename`. | Rust test writes then reads back |
| P1.6 ✅ | [CL] | **Per-tab undo history** (move history into the `Tab` store or a `Map<noteId, History>`), reset on tab switch; allow saving empty notes (drop `content.trim()` guard, keep the `activeNoteId` guard); single debounce; surface save errors in a status-bar toast. | Manual repro of A.3.1 no longer corrupts; unit test for history map |
| P1.7 | [OC] | **Async Rust commands**: convert `read_hadith_book`, `export_pandoc`, `search_dictionary`, `check_spelling`, `read_binary_file` to `async fn` (use `tauri::async_runtime::spawn_blocking` for CPU/IO-heavy bodies). | UI stays responsive during hadith load (manual) |
| P1.8 ✅ | [CL] | **Hadith in production**: move dataset under `src-tauri/resources/hadith/` (or compress to a single SQLite with FTS5 — preferred, also fixes 59 MB JSON → JS search cost), add to `bundle.resources`, resolve via `resource_dir()` like dictionaries. Remove `project_root()` usage outside `#[cfg(debug_assertions)]`. | `npm run tauri build` installer shows hadith results on a clean machine/VM |

#### Phase 1 status (2026-11-10)

Claude's tasks are done. **P1.5 was also done** (the atomic-write helper was needed anyway), so opencode has **P1.4, P1.7 and P1.9–P1.11** left.

**How it was built (read this before P1.4/P1.7):**
- **P1.1:** went a different way from the row above, on purpose. File commands still take **absolute** paths, but each one goes through `WorkspaceRegistry::resolve()` in `src-tauri/src/workspace.rs`. That rejects relative paths, `..` parts, and anything that (after following symlinks/junctions) ends up outside a trusted root. Roots become trusted only through Rust-side native UI the page can't fake: the default app-data workspace, `pick_workspace` (native folder picker), or `open_workspace` (native confirmation for a path that isn't trusted yet, e.g. old `localStorage`/recent entries). The trusted list is stored in `{appConfigDir}/trusted-workspaces.json`. New commands: `pick_workspace`, `open_workspace`, `list_files`. The webview no longer has `dialog:*` permissions.
- **P1.2:** `src/lib/sanitize.ts` (DOMPurify). It's applied at every `{@html}` and in the print-to-PDF iframe. Tests check that KaTeX output keeps every element and attribute. Raw HTML in notes still works, sanitised. External `http(s)`/`mailto` links open in the system browser (`src/lib/external-links.ts`, `opener:allow-open-url`).
- **P1.3:** CSP is set in `tauri.conf.json` (a separate, looser `devCsp` for Vite). The asset-protocol scope is empty in config and widened at runtime to trusted roots only. A copy of the build loaded with the CSP raised no violations.
- **P1.6:** Undo history is per note (`src/lib/note-history.ts`). Saving goes through `src/lib/save-queue.ts` + `src/lib/note-saver.ts`, a debounced queue that remembers which note each edit belongs to. Pending saves are written before switching note or workspace and dropped when a note is deleted. Empty notes now save, and save errors show as a toast. The editor is read-only while a note loads. App.svelte no longer re-reads the note from disk on every hierarchy change (that used to overwrite unsaved edits). Undo/redo now actually updates the store, so the change gets saved and previewed (before, it only changed the textarea).
- **P1.8:** Hadith JSON is bundled as `hadith/<book>.json` via `bundle.resources`, and `resource_path()` resolves it. The `project_root()` fallback is debug-only now. *Not done:* the SQLite/FTS5 conversion; it's moved to X4.

**Not verified (do these when MSVC is available):**
- `cargo test` was **not run**: this machine has no MSVC C++ toolset (VS 2026 Build Tools is installed without the "Desktop development with C++" workload), so nothing links. `cargo check --tests` passes. Run `cargo test --lib` in `src-tauri/` to execute the 9 workspace tests.
- No manual run in `npm run tauri dev` yet. Smoke test: open the default workspace; open another folder via the picker; pick a recent workspace (should prompt once, then not again); insert an image (assets render); undo after switching notes; empty a note, restart, and check it stays empty; hadith search in a release build.

| ID | Owner | Task | Done when |
|---|---|---|---|
| P1.9 | [OC] | Write pending saves (`noteSaver.flush()`) when the window is closing: `getCurrentWindow().onCloseRequested` in `App.svelte`, with `core:window:allow-destroy`/`allow-close` permissions as needed. | Closing within 500 ms of typing keeps the last keystrokes |
| P1.10 | [OC] | Update AGENTS.md / ARCHITECTURE.md: command list (+`pick_workspace`, `open_workspace`, `list_files`), the workspace trust model, the sanitize rule ("every `{@html}` goes through `sanitizeHtml`"), and the MSVC prerequisite for `cargo test`. | Docs match the code |
| P1.11 | [OC] | In P1.4, also reject `file_name` values that are Windows reserved names (`CON`, `NUL`, …) and add Rust tests in `workspace.rs` style. | `cargo test` passes |

### Phase 2 — One document pipeline (Claude)

This is the enabler for the math work. Do it behind the P0.5 golden tests.

| ID | Owner | Task | Done when |
|---|---|---|---|
| P2.1 | [CL] | **markdown-it token stream → publishing AST.** Write `src/lib/publishing/from-markdown-it.ts` that converts markdown-it tokens (with all app plugins) into the existing `ast.ts` types. Exporters consume this; retire the hand parser in `document.ts` (keep only metadata/front-matter helpers). | Every exporter produces output from the same parse the preview uses; `document.ts` parser deleted |
| P2.2 | [CL] | **Replace regex pre/post-processing with markdown-it plugins/rules:** hard breaks via `breaks: true` (drop blank-line injection), digit conversion as a core rule on `text` tokens only (never inside `math_*`, `code_*`, links), table captions as a block rule, equation labels/numbering inside the math rule (numbers attached to tokens, not matched by order), `dir` attributes via renderer rules, figure/table label language from document language. | Golden tests updated intentionally (diff reviewed); A.6.1 repro now leaves math digits alone |
| P2.3 | [CL] | **Render context instead of module state:** `renderMarkdown(text, opts) → { html, equations, figures, tables, citations, warnings }`. Remove `getLastCitationResult`/`getLastEquationResult` globals; make `blocks.ts` counters per-render. Remove the `console.warn` monkey-patch; KaTeX warnings go to `warnings[]`. | No module-level mutable render state remains (grep) |
| P2.4 | [OC] | Update callers (`Preview.svelte`, `EquationDialog.svelte`, `Stats.svelte`, `Outline`, etc.) to the new return type once P2.3 lands. | `npm run check` passes |
| P2.5 | [OC] | Debounce preview rendering (150 ms idle) and run kashida only after render settles. | Typing in a 50-page fixture shows no input lag (manual) |

### Phase 3 — Math symbol system (core by Claude, content by opencode)

Depends on P2.3 and P0.3.

| ID | Owner | Task | Done when |
|---|---|---|---|
| M1 | [CL] | **Single KaTeX instance.** Replace `@traptitech/markdown-it-katex` with an in-repo markdown-it math plugin (`src/lib/math/markdown-it-math.ts`, ~150 lines: inline `$…$`, display `$$…$$`, `\(…\)`, `\[…\]`, label `{#eq:x}`) that calls `katex-instance.ts`. Remove the duplicate `katex@0.16`. | `npm ls katex` shows one version; golden tests pass |
| M2 | [CL] | **`katex-instance.ts`**: shared `renderMath(src, { display, dir })` with one options object: `macros` (from registry), `trust` (only `\htmlClass` with `sw-` prefix), `strict: (code) => code === 'unicodeTextInMathMode' ? 'ignore' : 'warn'` with warnings captured, `output: 'htmlAndMathml'`. All components use it. | grep shows `katex` imported only in this file |
| M3 | [CL] | **Registry** (`registry.ts`) implementing the `MathSymbol` interface in B.3: `defineSymbol`, `getSymbols(category?)`, `searchSymbols(query)`, `toKatexMacros()`; validation rules from B.3; loader for `{workspace}/math-symbols.json`. | Unit tests: duplicate names rejected, invalid names rejected, macro expansion renders, glyph symbol produces `sw-sym` span |
| M4 | [OC] | **Populate `symbols/arabic-functions.ts`**: جا، جتا، ظا، ظتا، قا، قتا، لو، لط (ln)، نها، مجـ (sum label), plus inverse forms — each as `kind: 'macro'` using `\operatorname{\text{…}}`. Names and Arabic labels per the table in Appendix 1. | Each renders in the gallery; one test per symbol that `renderMath` produces no warnings |
| M5 | [OC] | **Populate `symbols/arabic-alphabet.ts`**: U+1EE00–U+1EEFF letters as `kind: 'glyph'` (generate from the Unicode data file, not by hand), font class `sw-font-arabicmath`. | Generated file + generator script in `scripts/`; renders with the bundled font chosen in M6 |
| M6 | [CL] | **Font evaluation**: pick and bundle a font that actually covers U+1EE00 block and Arabic text in math (test Noto Sans Math, XITS Math, others); write `@font-face` + `.sw-font-*` CSS; document coverage gaps. | Decision note in `docs/math-fonts.md` with screenshots |
| M7 | [CL] | **RTL math spike** (B.4 stage 2–3): MathML `dir="rtl"` in WebView2 with the chosen font; mirrored operator fallback; LaTeX RTL-math options. Output: go/no-go note + prototype behind a flag. | `docs/rtl-math-spike.md` + reference page comparison |
| M8 | [OC] | **Data-driven gallery**: refactor `KatexGallery.svelte` to read categories from the registry (move today's hard-coded arrays into `symbols/standard.ts` as `kind:'macro'` passthroughs); add Arabic search using `normalizeArabic`. | Gallery shows same items as before + new categories; search "جيب" finds `\jaa` |
| M9 | [OC] | **Custom-symbol editor dialog**: form to add/edit entries in `math-symbols.json` (name, Arabic label, macro body or Unicode char, category) with live preview via `renderMath`. Arabic UI labels. | Adding a symbol makes it usable in preview without restart |
| M10 | [CL] | **Diagnostics**: surface `warnings[]` from M2 for unknown macros/characters next to equations in preview, with "add as custom symbol" action that opens M9 prefilled. | Typing `$\foo$` shows a marker; action opens dialog |

### Phase 4 — Exporters

| ID | Owner | Task | Done when |
|---|---|---|---|
| E1 | [OC] | **Fix `escapeLatex`**: `\`→`\textbackslash{}`, `~`→`\textasciitilde{}`, `^`→`\textasciicircum{}`; others as now. Unit tests. | Tests pass |
| E2 | [OC] | **LaTeX preamble**: add `amsmath, amssymb, mathtools`, `unicode-math` (XeLaTeX branch), configurable Arabic font with cross-platform default (Amiri), `numerals` from the app's digit-style setting; emit `\label{eq:x}` and `\eqref{eq:x}` for refs. | Exported `Examples` project compiles with `xelatex` (document the command) |
| E3 | [CL] | **Registry → LaTeX** (`to-latex.ts`): collect only symbols used in the document, emit `\usepackage`s and `\newcommand`s into the preamble. Language switching for LTR blocks inside RTL docs (`\begin{english}`/`\textenglish`). | A doc using M4/M5 symbols compiles |
| E4 | [CL] | **Typst math**: use the `mitex` Typst package to render LaTeX math (emit `#import "@preview/mitex:…": *` and `#mitex(`…`)`/`#mi(`…`)`), registry macros passed as mitex definitions; fix the invalid numbered-block syntax. | Exported `.typ` compiles with `typst compile` |
| E5 | [OC] | **DOCX via Pandoc**: pass `-f markdown+latex_macros+tex_math_dollars`, `-M lang=ar`, `-M dir=rtl` (when RTL), a bundled `reference.docx` with Arabic styles (Amiri, RTL paragraphs), and prepend the registry `\newcommand` header from `to-pandoc.ts`. Convert app-specific syntax to Pandoc syntax first (from the AST, P2.1, not from raw markdown). | Word opens the file with RTL paragraphs and editable equations |
| E6 | [OC] | Cross-platform Pandoc lookup (`pandoc` / `pandoc.exe`), clear Arabic error when missing. | — |

### Phase 5 — Arabic-language fixes

| ID | Owner | Task | Done when |
|---|---|---|---|
| L1 | [OC] | **Spellcheck tokeniser**: in Rust, tokenise on Unicode word boundaries (`unicode-segmentation` crate), strip tashkeel (U+064B–U+065F, U+0670) and tatweel (U+0640) before `dict.check`, return `{word, start, end, suggestions}` offsets on the *original* text; length check via `chars().count()`; remove the per-call `.clone()`. Rust unit tests with vocalised Quranic text. | `كَتَبَ الطالبُ` yields no false fragments |
| L2 | [OC] | **Dictionary FTS5**: one-time build script that adds a normalised `word_norm` column + FTS5 table per dictionary (or one combined table); keep a single pooled `Connection` in Tauri state. | Search latency < 50 ms on a typical root (measure & note) |
| L3 | [OC] | Direction detection via first strong character (shared helper `detectDir(text)` in `src/lib/bidi.ts`) used by list/table rendering. Tests. | — |
| L4 | [OC] | Document-level language setting (front-matter `lang: ar|en`) drives figure/table/equation labels and equation-number digits. | — |

### Phase 6 — Editor & performance (Claude)

| ID | Owner | Task | Done when |
|---|---|---|---|
| X1 | [CL] | **Migrate textarea → CodeMirror 6** with `EditorView.perLineTextDirection`, markdown + LaTeX-in-math highlighting, native history (removes the custom stack), decorations for spelling and math diagnostics, `\` autocomplete from the registry. Keep the `insertAtCursor` API so all dialogs keep working. | All toolbar actions and dialogs work; undo per tab is native |
| X2 | [CL] | **Split `Editor.svelte`**: toolbar component, dialog host (one `activeDialog` enum instead of 20 booleans), editor core. | Editor.svelte < 400 lines |
| X3 | [CL] | **Incremental preview** for long documents: render per top-level block with caching keyed by block source hash; or render only the visible chapter. | 300-page fixture stays responsive |
| X4 | [OC] | Move hadith/Quran fuzzy search into a Web Worker (if hadith stays JSON) — skip if P1.8 moved it to SQLite FTS. | — |

### Phase 7 — Polish (opencode)

- [OC] Dialog consistency: focus trap, `Esc` closes, `Enter` confirms, return focus to editor.
- [OC] Extract Arabic UI strings into `src/lib/i18n/ar.ts` (no behaviour change) as groundwork for an English UI.
- [OC] Section numbering in Arabic ordinal words (الفصل الأول، المبحث الثاني…) using `tafqit.ts` ordinals — listed as missing in the feature-status file.
- [OC] Clean `ARCHITECTURE.md` to match the code after Phases 1–3.
- [OC] Commit the pending `TableEditor.svelte` / `table-utils.ts` work with tests for `extractTableAt` / `tableToMarkdown` (round-trip property: parse → serialise → parse is identity).

### Suggested order & ownership summary

```
P0 (OC, parallelisable) ─┬─> P1 (CL: P1.1–1.3, 1.6, 1.8 · OC: 1.4, 1.5, 1.7)
                         └─> P2 (CL) ──> M1–M3 (CL) ──> M4, M5, M8, M9 (OC) ; M6, M7, M10 (CL)
                                     └─> E1, E2, E5, E6 (OC) ; E3, E4 (CL)
L1–L4 (OC) any time after P0.3 · X1–X3 (CL) after M3 · Phase 7 (OC) last
```

Rough split: ~28 opencode tasks, ~20 Claude tasks; opencode carries most of the *volume*, Claude carries the *risk*.

---

## Part D — opencode hand-off brief

Paste this into opencode with each task ID.

- **Read first:** `AGENTS.md`, this file's task row, and the files it names. Do not refactor beyond the task.
- **Conventions:** Svelte 5 *compatibility* syntax only — `$:`, `$store`, `on:event`, `createEventDispatcher`; **no runes**. TypeScript strict. Arabic UI labels for anything user-visible. RTL-aware CSS (use logical properties: `margin-inline-start`, not `margin-left`).
- **Commands:** `npm run check` (must be 0 errors), `npm run test` (after P0.3), `cargo test` and `cargo check` in `src-tauri/` for Rust tasks.
- **Every task ships tests** for the behaviour it adds or fixes. If you find an unrelated bug, add an `it.todo` with a one-line description — do not fix it in the same change.
- **Do not touch** without a [CL] task covering it: `src/lib/markdown.ts` render pipeline, `src/lib/publishing/document.ts`, `src-tauri/src/lib.rs` FS commands' path handling, `tauri.conf.json` security section, `capabilities/`.
- **Data files** (`docs/hadith-json-*`, `src-tauri/db/`, `src/lib/quran.json`) are read-only inputs; never rewrite them by hand — use a script in `scripts/` and commit the script.
- **One commit per task**, message `type(scope): summary [TASK-ID]`.

---

## Appendix 1 — Arabic function names for M4

Conventional Arabic school/university notation (verify against the target curriculum; Maghrib and Mashriq conventions differ in places):

| Macro | Arabic | Meaning |
|---|---|---|
| `\jaa` | جا | sin |
| `\jataa` | جتا | cos |
| `\dhaa` | ظا | tan |
| `\dhataa` | ظتا | cot |
| `\qaa` | قا | sec |
| `\qataa` | قتا | csc |
| `\lugh` | لو | log |
| `\lugt` | لط | ln |
| `\nihaya` | نها | lim (operator with limits below) |
| `\majmu` | مجـ | Σ label (operator with limits) |

`\nihaya` and `\majmu` must be `\operatorname*{…}` (starred) so limits go under/over in display mode.

## Appendix 2 — Verified findings log

Things reproduced during this review (not just read):

- `npm run check` → 0 errors, 7 warnings (2026-11-10).
- Digit conversion inside multi-line `$$` blocks produces `s_١^٢` and KaTeX `unknownSymbol` warnings (node repro against the installed markdown-it + `@traptitech/markdown-it-katex`).
- `npm ls`-equivalent check: `katex@0.17.0` top-level and `katex@0.16.47` nested under `@traptitech/markdown-it-katex`.

Everything else in Part A is from reading the code at the cited lines; the undo-history data-loss path (A.3.1) and the XSS→FS chain (A.2) should be confirmed manually in `npm run tauri dev` before/after the fix as part of P1.6 and P1.2.
