# AGENTS.md — Arabic Scientific Writing App (الكاتب العلمي)

## Stack
- **Desktop shell**: Tauri v2 (Rust backend in `src-tauri/`)
- **Frontend**: SvelteKit 2 with `@sveltejs/adapter-static` (SPA mode, SSR disabled)
- **Language**: TypeScript (frontend), Rust (backend)
- **Bundler**: Vite 6, dev server locked to port 1420
- **Markdown**: markdown-it v14 + `@traptitech/markdown-it-katex` + highlight.js
- **Fuzzy search**: fuse.js v7
- **Hijri calendar**: @umalqura/core
- **Word export**: docx (via Pandoc)
- **Dictionaries**: rusqlite with 10 Arabic lexicons embedded

## Project layout
```
scientific-writer/
├── src/                  # SvelteKit frontend
│   ├── App.svelte        # Main three-panel layout + SplashScreen
│   ├── app.css           # Global styles (RTL, dark theme, KaTeX)
│   ├── components/       # 21 Svelte components (Editor, panels, dialogs)
│   ├── lib/              # Stores, FS wrapper, markdown, search, templates…
│   └── routes/           # +page.svelte, +layout.svelte, +layout.ts
├── src-tauri/            # Rust Tauri backend
│   ├── src/lib.rs        # 20 commands: workspace, file I/O, assets, hadith, dictionary, spellcheck, pandoc
│   ├── src/workspace.rs  # Trusted-root registry, path resolution, atomic writes
│   ├── src/main.rs
│   ├── db/dicts.sqlite   # Embedded Arabic lexicons database
│   ├── tauri.conf.json
│   └── capabilities/default.json
├── docs/
│   ├── hadith-json-1.2.0/  # 9-book hadith dataset
│   └── quran-*.{sql,txt,xml}
├── static/
├── ARCHITECTURE.md
└── AGENTS.md
```

## Developer commands (run from `scientific-writer/`)
| Command | Purpose |
|---------|---------|
| `npm run dev` | Frontend-only Vite dev server (http://localhost:1420) |
| `npm run build` | Build the frontend to `build/` |
| `npm run check` | Typecheck: `svelte-kit sync && svelte-check --tsconfig ./tsconfig.json` |
| `npm run test` | Unit/golden tests (Vitest) |
| `npm run tauri dev` | Full Tauri desktop app with hot reload |
| `npm run tauri build` | Build production desktop app bundle |

Run `check` and `test` before committing. Rust tests use `cargo test` in
`src-tauri/`; this requires the MSVC C++ toolset (Visual Studio Build Tools with
the **Desktop development with C++** workload), not just `cargo check`.

## Svelte convention
Written in Svelte 5 compatibility syntax (no runes): `$:` reactive statements, `$store` auto-subscription, `on:event` handlers, `createEventDispatcher`. Follow existing style for consistency.

## RTL & theming
- Full RTL layout (`direction: rtl` on `<body>`), dark theme (`--bg: #121212`)
- Arabic UI labels throughout (e.g., "ملاحظة جديدة.md", "إعادة تسمية")
- CSS custom properties in `src/app.css`

## Security conventions
- **All file access is workspace-scoped.** Webview-supplied paths go through
  `WorkspaceRegistry::resolve()` (`src-tauri/src/workspace.rs`), which rejects
  relative paths, `..` components and anything outside a trusted root (after
  following symlinks/junctions). Never call `std::fs` directly on an
  unvalidated path in a command.
- **Trust is granted only by Rust-side native UI**: the default app-data
  workspace, `pick_workspace` (folder picker) or `open_workspace` (native
  confirmation). Trusted roots persist in
  `{appConfigDir}/trusted-workspaces.json`.
- **Every `{@html}` sink must call `sanitizeHtml()`** (`src/lib/sanitize.ts`,
  DOMPurify). Raw HTML in notes remains allowed, but sanitised.
- **CSP is enabled** (`tauri.conf.json`); the asset protocol starts empty and is
  widened at runtime only for trusted roots.
- **Asset names** must be a single basename (no separators, `..`, drive/ADS
  colons, or Windows reserved names). **Pandoc export formats** are limited to
  `docx`, `odt`, `epub`, `html`.

## Workspace & persistence
- Default workspace: `{appDataDir}/scientific-writer/workspace/`
- Additional workspaces are opened through native trust prompts; the recent
  list lives in `localStorage`, the trusted roots in app config (backend-owned).
- Hierarchy saved as `hierarchy.json`, notes as `{id}.md` files
- Bibliography stored as `references.bib` in workspace
- Saves go through `noteSaver` (`src/lib/note-saver.ts` + `save-queue.ts`): a
  per-note debounced queue, flushed before note/workspace switches and on window
  close, with errors shown as a toast.
- Text writes and asset copies are atomic (temp file + rename).
- Auto-recovery backups are written to `{workspace}/.backups/` (git-ignored).
- 5 document templates available (thesis, article, book, lecture, classical-book)

## New-project templates
- 5 built-in templates in `src/lib/templates/`: thesis, article, book, lecture, classical-book
- Each generates a folder/note hierarchy with pre-written sample content
- Extensible via `registerTemplate()` — no limit on number of templates
- Triggered from `NewProjectDialog.svelte` (accessible from HierarchyTree)

## Tauri details
- `tauri.conf.json` configures the window (1400×900), a strict CSP, and an
  asset-protocol scope widened at runtime to trusted workspaces
- Rust backend has 20 commands: workspace (3), file I/O (9), assets (2), hadith (2), dictionary (2), spellcheck (1), pandoc export (1)
- `src-tauri/db/dicts.sqlite` bundled with 10 Arabic dictionaries (Lisan al-Arab, Al-Waseet, etc.)
- `src-tauri/capabilities/default.json` grants only core window + opener
  permissions; there are no generic FS or dialog permissions for the webview
- Plugins: `tauri_plugin_dialog` (called from Rust only), `tauri_plugin_opener`
- `src-tauri/.gitignore` ignores `/target/` and `/gen/schemas`
