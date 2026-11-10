# الكاتب العلمي — Scientific Writer

An Arabic-first desktop writing environment for scholars, students and authors of
Arabic scientific and classical texts. Built with **Tauri v2**, **SvelteKit 2** and
**Rust**.

The editor is fully RTL, works offline, and treats Arabic typography as a
first-class concern: kashida justification, Arabic-Indic digits, diacritics,
Hijri dates, tafqīt, Qurʾān/Ḥadīth citation and classical
matn/sharḥ/ḥāshiyah layouts.

## Features

- **RTL Markdown editor** with live preview, tabs, workspace tree and auto-save.
- **Arabic typography**: kashida, ligature and variable-font controls, diacritic
  palette, Arabic-Indic / Western digit styles.
- **Qurʾān and Ḥadīth tools**: search and insert verses/ḥadīth with references.
- **Arabic lexicons**: lookup in 10 classical dictionaries (Lisan al-Arab,
  Al-Waseet, Lane's Lexicon, Hans Wehr, …), by word or root.
- **Hijri ↔ Gregorian** date conversion and Arabic date formatting.
- **Tafqīt** (تفقيط): numbers written out in Arabic words.
- **Citations**: BibTeX parsing, Arabic CSL labels, manuscript (`@ms:`) and
  ṭabaqāt (`@tab:`) citation formats, bibliography generation.
- **Classical layouts**: interlinear glosses and `:::matn` / `:::sharh` /
  `:::hashiyah` blocks.
- **Exports**: LaTeX, Typst, DOCX (via Pandoc), HTML and manuscript compilation.

## Prerequisites

| Requirement | Notes |
|---|---|
| **Node.js ≥ 20** | Includes npm. |
| **Rust stable** | Install via [rustup](https://rustup.rs/). On Windows use the `x86_64-pc-windows-msvc` toolchain. |
| **C++ build tools** | Windows: *Visual Studio Build Tools* with the **Desktop development with C++** workload and a Windows SDK. macOS: Xcode Command Line Tools. Linux: `build-essential`, `webkit2gtk-4.1`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`. See the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). |
| **WebView2** | Windows 10/11: pre-installed on Windows 11 and up-to-date Windows 10; otherwise install the Evergreen runtime. |
| **Pandoc** (optional) | Required only for DOCX/ODT/EPUB export. Install from [pandoc.org](https://pandoc.org/installing.html) and make sure `pandoc` is on `PATH`. |
| **XeLaTeX** (optional) | Required to compile exported `.tex` files; any TeX Live/MiKTeX installation with `xelatex` works. |

## Getting started

```bash
git clone <repository-url> scientific-writer
cd scientific-writer
npm install
```

### 1. Add the dictionary database (required for dictionary lookup)

`src-tauri/db/dicts.sqlite` is **not tracked in git** because it is a ~165 MB
SQLite database. Obtain a copy from the project maintainer or from an existing
checkout/backup, then place it at:

```
src-tauri/db/dicts.sqlite
```

The file is bundled into the application by `tauri.conf.json`
(`bundle.resources`). It contains the 10 dictionaries exposed by the app
(`lisanularab`, `mujamul_wasith`, `mujamul_shihah`, `maqayeesul_luga`,
`mufradat_alfajul_quran`, `mujamul_ghoni`, `mujamul_muashiroh`,
`mujamul_muhith`, `hanswehr`, `lanelexcon`). To verify a copy on Windows:

```powershell
Get-Item src-tauri\db\dicts.sqlite | Select-Object Length
# expected: roughly 165 MB (173,000,000+ bytes, non-zero)
```

Without this file the dictionary panel cannot work.

### 2. Run the desktop app

```bash
npm run tauri dev
```

The first Rust build takes several minutes and can produce a `src-tauri/target/`
directory of 10 GB or more. Run `cargo clean` inside `src-tauri/` to reclaim it;
the directory is ignored by git.

## Developer commands

Run from the repository root.

| Command | Purpose |
|---|---|
| `npm run dev` | Frontend-only Vite dev server (http://localhost:1420) |
| `npm run build` | Build the frontend to `dist/` |
| `npm run check` | Typecheck (`svelte-kit sync && svelte-check`) |
| `npm run test` | Unit and golden-snapshot tests (Vitest) |
| `npm run tauri dev` | Full desktop app with hot reload |
| `npm run tauri build` | Production desktop bundle (installer) |

Backend checks run from `src-tauri/`:

```bash
cargo check
cargo test
```

## Project structure

```
scientific-writer/
├── src/                        # SvelteKit frontend (SPA mode)
│   ├── App.svelte              # Three-panel shell + splash screen
│   ├── components/             # Editor, panels, dialogs
│   ├── lib/                    # Stores, FS wrapper, markdown, search, exporters
│   │   ├── publishing/         # AST + LaTeX/Typst/DOCX/HTML exporters
│   │   ├── templates/          # 5 new-project templates
│   │   └── __tests__/          # Vitest unit + golden tests
│   └── routes/
├── src-tauri/                  # Rust backend
│   ├── src/lib.rs              # Tauri commands (file I/O, ḥadīth, dictionaries, Pandoc)
│   ├── db/dicts.sqlite         # Arabic lexicons (git-ignored, add manually)
│   ├── resources/hunspell/     # ar.aff / ar.dic
│   ├── tauri.conf.json
│   └── capabilities/
├── docs/                       # Ḥadīth dataset, Qurʾān data, feature status
├── tests/fixtures/             # Golden-test fixtures (readable sample workspace)
├── static/fonts/               # Bundled OFL fonts
└── ARCHITECTURE.md             # Deeper design notes
```

## Data files

| Path | Size | Notes |
|---|---|---|
| `docs/hadith-json-1.2.0/` | ~59 MB | 9-book Ḥadīth dataset (JSON). |
| `src/lib/quran.json` | — | 6,236 Qurʾān verses for search/insert. |
| `src-tauri/db/dicts.sqlite` | ~165 MB | Arabic lexicons; **not in git** (see above). |
| `src-tauri/resources/hunspell/` | ~7 MB | Arabic Hunspell dictionary for spellcheck. |

## Troubleshooting

- **Port 1420 already in use** — stop the other Vite/Tauri instance; the dev
  server uses a strict port.
- **Pandoc not found** — install Pandoc and restart the app, or make sure
  `pandoc.exe` is next to the executable or on `PATH`.
- **Huge `src-tauri/target/`** — Rust build artifacts and incremental caches.
  `cargo clean` inside `src-tauri/` is safe.
- **Dictionary panel reports a missing database** — verify
  `src-tauri/db/dicts.sqlite` exists and is not a Git LFS placeholder.

## License

MIT.
