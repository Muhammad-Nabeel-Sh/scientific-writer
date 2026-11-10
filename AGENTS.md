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
│   ├── src/lib.rs        # 17 commands: file I/O, assets, hadith, dictionary, spellcheck, pandoc
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
| `npm run build` | Build frontend to `dist/` |
| `npm run check` | Typecheck: `svelte-kit sync && svelte-check --tsconfig ./tsconfig.json` |
| `npm run test` | Unit/golden tests (Vitest) |
| `npm run tauri dev` | Full Tauri desktop app with hot reload |
| `npm run tauri build` | Build production desktop app bundle |

Run `check` and `test` before committing.

## Svelte convention
Written in Svelte 5 compatibility syntax (no runes): `$:` reactive statements, `$store` auto-subscription, `on:event` handlers, `createEventDispatcher`. Follow existing style for consistency.

## RTL & theming
- Full RTL layout (`direction: rtl` on `<body>`), dark theme (`--bg: #121212`)
- Arabic UI labels throughout (e.g., "ملاحظة جديدة.md", "إعادة تسمية")
- CSS custom properties in `src/app.css`

## Workspace & persistence
- Notes stored in Tauri app data dir: `{appDataDir}/scientific-writer/workspace/`
- Workspace path cached in `localStorage` (custom paths supported via `setWorkspaceDir`)
- Hierarchy saved as `hierarchy.json`, notes as `{id}.md` files
- Bibliography stored as `references.bib` in workspace
- Custom Rust commands in `src-tauri/src/lib.rs` handle all file operations via `std::fs`
- Auto-save via 500ms debounce + Ctrl+S handler
- 5 document templates available (thesis, article, book, lecture, classical-book)

## New-project templates
- 5 built-in templates in `src/lib/templates/`: thesis, article, book, lecture, classical-book
- Each generates a folder/note hierarchy with pre-written sample content
- Extensible via `registerTemplate()` — no limit on number of templates
- Triggered from `NewProjectDialog.svelte` (accessible from HierarchyTree)

## Tauri details
- `tauri.conf.json` configures window (1400×900), CSP disabled, FS plugin
- Rust backend has 17 commands: file I/O (8), assets (3), hadith (2), dictionary (2), spellcheck (1), pandoc export (1)
- `src-tauri/db/dicts.sqlite` bundled with 10 Arabic dictionaries (Lisan al-Arab, Al-Waseet, etc.)
- `src-tauri/capabilities/default.json` grants FS read/write/create/remove/rename and path permissions
- Plugins: `tauri_plugin_dialog`, `tauri_plugin_opener`
- `src-tauri/.gitignore` ignores `/target/` and `/gen/schemas`
