# AGENTS.md — Arabic Scientific Writing App

## Stack
- **Desktop shell**: Tauri v2 (Rust backend in `src-tauri/`)
- **Frontend**: SvelteKit 2 with `@sveltejs/adapter-static` (SPA mode, SSR disabled)
- **Language**: TypeScript (frontend), Rust (backend)
- **Bundler**: Vite 6, dev server locked to port 1420
- **Markdown**: markdown-it v14 + markdown-it-katex for LaTeX math

## Project layout
```
scientific-writer/
├── src/                  # SvelteKit frontend
│   ├── App.svelte        # Main three-panel layout
│   ├── components/       # Editor, HierarchyTree, Preview panels
│   ├── lib/              # stores.ts, fs.ts (Tauri FS wrapper), markdown.ts
│   └── routes/           # +page.svelte, +layout.ts (ssr = false)
├── src-tauri/            # Rust Tauri backend
│   ├── src/lib.rs, main.rs
│   └── tauri.conf.json
└── static/
```

## Developer commands (run from `scientific-writer/`)
| Command | Purpose |
|---------|---------|
| `npm run dev` | Frontend-only Vite dev server (http://localhost:1420) |
| `npm run build` | Build frontend to `dist/` |
| `npm run check` | Typecheck: `svelte-kit sync && svelte-check --tsconfig ./tsconfig.json` |
| `npm run tauri dev` | Full Tauri desktop app with hot reload |
| `npm run tauri build` | Build production desktop app bundle |

Run `check` before committing. No lint or test infrastructure exists yet.

## Known codebase issues
- **`src/lib/utils.ts` is missing** — imported by `Editor.svelte` (`debounce`) and `HierarchyTree.svelte` (`createId`), does not exist. Must be created before the app will build.
- **`App.svelte` imports from `$lib/components/`** but components live in `src/components/`, not `src/lib/components/`. SvelteKit's `$lib` maps to `src/lib/`, so these imports are broken.

## Svelte convention
Written in Svelte 4 compatibility syntax (no runes): `$:` reactive statements, `$store` auto-subscription, `on:event` handlers. Follow existing style for consistency.

## RTL & theming
- Full RTL layout (`direction: rtl` on `<body>`), dark theme (`--bg: #121212`)
- Arabic UI labels throughout (e.g., "ملاحظة جديدة.md", "إعادة تسمية")
- CSS custom properties in `src/app.css`

## Workspace & persistence
- Notes stored in Tauri app data dir: `{appDataDir}/scientific-writer/workspace/`
- Hierarchy saved as `hierarchy.json`, notes as `{id}.md` files
- Custom Rust commands in `src-tauri/src/lib.rs` handle all file operations via `std::fs`
- Auto-save via 500ms debounce + Ctrl+S handler

## Tauri details
- `tauri.conf.json` configures window (1400×900), CSP disabled, FS plugin with `requireLiteralLeadingDot: false`
- Rust backend currently has only a placeholder `greet` command
- `src-tauri/capabilities/default.json` grants FS read/write/create/remove/rename and path permissions
- `src-tauri/.gitignore` ignores `/target/` and `/gen/schemas`
