mod workspace;

use rusqlite::Connection;
use serde::Serialize;
use spellbook::Dictionary;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Manager, State};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use workspace::{write_atomic, WorkspaceRegistry};

type Ws<'a> = State<'a, WorkspaceRegistry>;

fn workspace_dir(app: &tauri::AppHandle) -> PathBuf {
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");
    data_dir.join("scientific-writer").join("workspace")
}

/// Source checkout root. Only meaningful in debug builds, where data files are
/// read straight from the repository instead of the bundle's resource dir.
#[cfg(debug_assertions)]
fn project_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("failed to resolve project root")
        .to_path_buf()
}

/// Resolve a bundled resource: `<resource_dir>/<bundled>` in production,
/// `<repo>/<dev_rel>` as a fallback in debug builds only.
fn resource_path(app: &tauri::AppHandle, bundled: &str, dev_rel: &str) -> PathBuf {
    let bundled_path = app.path().resource_dir().map(|d| d.join(bundled));
    if let Ok(p) = &bundled_path {
        if p.exists() {
            return p.clone();
        }
    }
    #[cfg(debug_assertions)]
    {
        let _ = bundled_path;
        project_root().join(dev_rel)
    }
    #[cfg(not(debug_assertions))]
    {
        let _ = dev_rel;
        bundled_path.unwrap_or_else(|_| PathBuf::from(bundled))
    }
}

/// Let the asset protocol (convertFileSrc) serve files from a trusted root.
fn allow_asset_dir(app: &tauri::AppHandle, dir: &Path) {
    let _ = app.asset_protocol_scope().allow_directory(dir, true);
}

// ── Workspace selection ───────────────────────────────────────────────

#[tauri::command]
fn get_workspace_dir(app: tauri::AppHandle, ws: Ws) -> Result<String, String> {
    let dir = workspace_dir(&app);
    fs::create_dir_all(&dir).map_err(|e| format!("mkdir: {}", e))?;
    if !ws.is_trusted(&dir) {
        ws.trust(&dir)?;
    }
    allow_asset_dir(&app, &dir);
    Ok(dir.to_string_lossy().to_string())
}

/// Native folder picker. The picked folder becomes a trusted workspace.
/// Returns `None` when the user cancels.
#[tauri::command]
async fn pick_workspace(app: tauri::AppHandle, ws: Ws<'_>) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .set_title("اختر مجلد مساحة العمل (المشروع)")
        .blocking_pick_folder();
    let Some(fp) = picked else { return Ok(None) };
    let path = fp.into_path().map_err(|e| e.to_string())?;
    let canon = ws.trust(&path)?;
    allow_asset_dir(&app, &canon);
    Ok(Some(path.to_string_lossy().to_string()))
}

/// Open a workspace by path (recent list, saved setting). Already-trusted
/// folders open directly; anything else needs the user to confirm in a
/// native dialog, which page content cannot answer on the user's behalf.
#[tauri::command]
async fn open_workspace(app: tauri::AppHandle, ws: Ws<'_>, path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    if !p.is_absolute() || !p.is_dir() {
        return Err(format!("المجلد غير موجود: {}", path));
    }
    if !ws.is_trusted(&p) {
        let ok = app
            .dialog()
            .message(format!(
                "هل تريد منح التطبيق صلاحية القراءة والكتابة في هذا المجلد؟\n\n{}",
                path
            ))
            .title("فتح مساحة عمل")
            .kind(MessageDialogKind::Warning)
            .buttons(MessageDialogButtons::OkCancelCustom("فتح".into(), "إلغاء".into()))
            .blocking_show();
        if !ok {
            return Err("ألغى المستخدم فتح مساحة العمل".into());
        }
        ws.trust(&p)?;
    }
    allow_asset_dir(&app, &p);
    Ok(path)
}

// ── File commands (all confined to trusted workspaces) ────────────────

#[tauri::command]
fn copy_file_to_assets(ws: Ws, workspace: String, file_name: String, data: Vec<u8>) -> Result<String, String> {
    let assets_dir = ws.resolve(&workspace)?.join("assets");
    fs::create_dir_all(&assets_dir).map_err(|e| format!("mkdir assets: {}", e))?;
    let dest = ws.resolve(&assets_dir.join(&file_name).to_string_lossy())?;
    fs::write(&dest, &data).map_err(|e| format!("write: {}", e))?;
    Ok(format!("assets/{}", file_name))
}

fn list_files_in(dir: &Path) -> Result<Vec<String>, String> {
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut files = vec![];
    for entry in fs::read_dir(dir).map_err(|e| format!("read_dir: {}", e))? {
        let entry = entry.map_err(|e| format!("entry: {}", e))?;
        if entry.file_type().map_err(|e| format!("ftype: {}", e))?.is_file() {
            if let Some(name) = entry.file_name().to_str() {
                files.push(name.to_string());
            }
        }
    }
    files.sort();
    Ok(files)
}

#[tauri::command]
fn list_assets(ws: Ws, workspace: String) -> Result<Vec<String>, String> {
    list_files_in(&ws.resolve(&workspace)?.join("assets"))
}

/// List plain files directly inside `dir` (used for `.backups`).
#[tauri::command]
fn list_files(ws: Ws, dir: String) -> Result<Vec<String>, String> {
    list_files_in(&ws.resolve(&dir)?)
}

#[tauri::command]
fn read_text_file(ws: Ws, path: String) -> Result<String, String> {
    fs::read_to_string(ws.resolve(&path)?).map_err(|e| format!("read: {}", e))
}

#[tauri::command]
fn read_binary_file(ws: Ws, path: String) -> Result<Vec<u8>, String> {
    fs::read(ws.resolve(&path)?).map_err(|e| format!("read binary: {}", e))
}

#[tauri::command]
fn write_text_file(ws: Ws, path: String, content: String) -> Result<(), String> {
    let p = ws.resolve(&path)?;
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir parent: {}", e))?;
    }
    write_atomic(&p, content.as_bytes())
}

#[tauri::command]
fn create_dir(ws: Ws, path: String, recursive: bool) -> Result<(), String> {
    let p = ws.resolve(&path)?;
    if recursive {
        fs::create_dir_all(&p).map_err(|e| format!("mkdir: {}", e))
    } else {
        fs::create_dir(&p).map_err(|e| format!("mkdir: {}", e))
    }
}

#[tauri::command]
fn remove_file(ws: Ws, path: String) -> Result<(), String> {
    fs::remove_file(ws.resolve(&path)?).map_err(|e| format!("remove: {}", e))
}

#[tauri::command]
fn rename_file(ws: Ws, old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(ws.resolve(&old_path)?, ws.resolve(&new_path)?).map_err(|e| format!("rename: {}", e))
}

#[tauri::command]
fn file_exists(ws: Ws, path: String) -> bool {
    ws.resolve(&path).map(|p| p.exists()).unwrap_or(false)
}

#[tauri::command]
fn copy_file(ws: Ws, src: String, dest: String) -> Result<(), String> {
    let src = ws.resolve(&src)?;
    let dest = ws.resolve(&dest)?;
    let data = fs::read(&src).map_err(|e| format!("read src: {}", e))?;
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir: {}", e))?;
    }
    write_atomic(&dest, &data)
}

#[tauri::command]
fn export_pandoc(app: tauri::AppHandle, ws: Ws, workspace: String, markdown: String, format: String) -> Result<Vec<u8>, String> {
    use std::process::Command;

    // Look for a bundled pandoc next to the app executable first,
    // then fall back to system PATH.
    fn find_pandoc(app: &tauri::AppHandle) -> String {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                let bundled = dir.join("pandoc.exe");
                if bundled.exists() {
                    return bundled.to_string_lossy().to_string();
                }
            }
        }
        if let Ok(res_dir) = app.path().resource_dir() {
            let bundled = res_dir.join("pandoc.exe");
            if bundled.exists() {
                return bundled.to_string_lossy().to_string();
            }
        }
        "pandoc".to_string()
    }

    let pandoc_bin = find_pandoc(&app);

    let ws_path = ws.resolve(&workspace)?;
    let in_path = ws.resolve(&ws_path.join(".temp_export.md").to_string_lossy())?;
    let out_path = ws.resolve(&ws_path.join(format!(".temp_export.{}", format)).to_string_lossy())?;

    fs::write(&in_path, &markdown).map_err(|e| format!("write md error: {}", e))?;

    let output = Command::new(&pandoc_bin)
        .current_dir(&ws_path)
        .arg(&in_path)
        .arg("-o")
        .arg(&out_path)
        .output()
        .map_err(|e| format!(
            "Pandoc not found. Please install Pandoc (https://pandoc.org/installing.html) or place pandoc.exe next to the application. Error: {}",
            e
        ))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        let _ = fs::remove_file(&in_path);
        return Err(format!("Pandoc error: {}", err));
    }

    let bytes = fs::read(&out_path).map_err(|e| format!("read output error: {}", e))?;

    let _ = fs::remove_file(&in_path);
    let _ = fs::remove_file(&out_path);

    Ok(bytes)
}

// ── Hadith ────────────────────────────────────────────────────────────

const HADITH_BOOKS: &[&str] = &[
    "abudawud", "ahmed", "bukhari", "darimi", "ibnmajah", "malik", "muslim", "nasai", "tirmidhi",
];

#[tauri::command]
fn get_hadith_books() -> Vec<&'static str> {
    HADITH_BOOKS.to_vec()
}

#[tauri::command]
fn read_hadith_book(app: tauri::AppHandle, book: String) -> Result<String, String> {
    if !HADITH_BOOKS.contains(&book.as_str()) {
        return Err(format!("unknown book: {}", book));
    }
    // Bundled as `hadith/<book>.json` (see tauri.conf.json bundle.resources).
    let path = resource_path(
        &app,
        &format!("hadith/{}.json", book),
        &format!("docs/hadith-json-1.2.0/db/by_book/the_9_books/{}.json", book),
    );
    fs::read_to_string(&path).map_err(|e| format!("read hadith {:?}: {}", path, e))
}

// ── Arabic dictionary lookup ──────────────────────────────────────────

#[derive(Serialize)]
struct DictEntry {
    word: String,
    meanings: String,
    dict_name: String,
    dict_ar: String,
}

const DICTS: &[(&str, &str, &str, &str)] = &[
    // (table, arabic_name, english_name, group)
    ("lisanularab", "لسان العرب", "Lisan al-Arab", "ar"),
    ("mujamul_wasith", "الوسيط", "Al-Waseet", "ar"),
    ("mujamul_shihah", "مختار الصحاح", "Mukhtar al-Sihah", "ar"),
    ("maqayeesul_luga", "مقاييس اللغة", "Maqayis al-Lugha", "ar"),
    ("mufradat_alfajul_quran", "مفردات القرآن", "Mufradat al-Quran", "ar"),
    ("mujamul_ghoni", "الغني", "Al-Ghani", "ar"),
    ("mujamul_muashiroh", "المعاصرة", "Al-Muashirah", "ar"),
    ("mujamul_muhith", "المحيط", "Al-Muhit", "ar"),
    ("hanswehr", "هانز", "Hans Wehr", "ar_en"),
    ("lanelexcon", "لين", "Lane's Lexicon", "ar_en"),
];

fn dict_db_path(app: &tauri::AppHandle) -> PathBuf {
    resource_path(app, "db/dicts.sqlite", "src-tauri/db/dicts.sqlite")
}

/// Search a word/root in a specific dictionary.
fn search_dict(
    conn: &Connection,
    query: &str,
    dict_table: &str,
    search_by_root: bool,
) -> Result<Vec<DictEntry>, String> {
    let (col, extra) = match (dict_table, search_by_root) {
        ("mujamul_ghoni", true) => ("root", ""),
        ("hanswehr", true) => ("word", "AND is_root = 1"),
        ("lanelexcon", true) => ("word", "AND is_root = 1"),
        (_, true) => ("word", ""), // for lisan, maqayees, mufradat, word IS root
        (_, false) => ("word", ""),
    };
    let sql = format!(
        "SELECT word, meanings FROM \"{}\" WHERE {} LIKE ?1 {} ORDER BY word LIMIT 30",
        dict_table, col, extra
    );
    let pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(&sql).map_err(|e| format!("prepare: {}", e))?;
    let rows = stmt
        .query_map([&pattern], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| format!("query: {}", e))?;

    let mut results = Vec::new();
    for row in rows {
        let (word, meanings) = row.map_err(|e| format!("row: {}", e))?;
        let (_, dict_ar, dict_en, _) = DICTS
            .iter()
            .find(|(t, _, _, _)| *t == dict_table)
            .unwrap_or(&("", "", "", ""));
        results.push(DictEntry {
            word,
            meanings,
            dict_name: dict_en.to_string(),
            dict_ar: dict_ar.to_string(),
        });
    }
    Ok(results)
}

#[tauri::command]
fn search_dictionary(
    app: tauri::AppHandle,
    query: String,
    dict_table: Option<String>,
    search_mode: Option<String>,   // "word" | "root", default "word"
    dict_group: Option<String>,    // "all" | "ar" | "ar_en", default "all"
) -> Result<Vec<DictEntry>, String> {
    let db_path = dict_db_path(&app);
    let conn =
        Connection::open(&db_path).map_err(|e| format!("open db {:?}: {}", db_path, e))?;

    let search_by_root = search_mode.as_deref() == Some("root");

    let dicts_iter: Box<dyn Iterator<Item = &(&str, &str, &str, &str)>> = match dict_table {
        Some(table) => {
            if !DICTS.iter().any(|(t, _, _, _)| *t == table) {
                return Err(format!("unknown dictionary: {}", table));
            }
            Box::new(DICTS.iter().filter(move |(t, _, _, _)| *t == table))
        }
        None => {
            let group = dict_group.as_deref().unwrap_or("all");
            match group {
                "ar" => Box::new(DICTS.iter().filter(|(_, _, _, g)| *g == "ar")),
                "ar_en" => Box::new(DICTS.iter().filter(|(_, _, _, g)| *g == "ar_en")),
                _ => Box::new(DICTS.iter()),
            }
        }
    };

    let mut all = Vec::new();
    for (table, _, _, _) in dicts_iter {
        let results = search_dict(&conn, &query, table, search_by_root)?;
        all.extend(results);
    }
    all.sort_by(|a, b| a.word.cmp(&b.word));
    all.truncate(60);
    Ok(all)
}

#[tauri::command]
fn list_dictionaries() -> Vec<serde_json::Value> {
    DICTS.iter()
        .map(|(table, ar, en, group)| {
            serde_json::json!({
                "table": table,
                "ar": ar,
                "en": en,
                "group": group,
            })
        })
        .collect()
}

// ── Hunspell spellcheck ──────────────────────────────────────────────

struct SpellcheckState {
    dict: Mutex<Option<Dictionary<spellbook::DefaultHashBuilder>>>,
}

fn hunspell_dir(app: &tauri::AppHandle) -> PathBuf {
    resource_path(app, "hunspell", "src-tauri/resources/hunspell")
}

fn load_dictionary(app: &tauri::AppHandle) -> Result<Dictionary<spellbook::DefaultHashBuilder>, String> {
    let dir = hunspell_dir(app);
    let dic_path = dir.join("ar.dic");
    let aff_path = dir.join("ar.aff");

    let dic_str = fs::read_to_string(&dic_path)
        .map_err(|e| format!("فشل قراءة ملف القاموس: {}", e))?;
    let aff_str = fs::read_to_string(&aff_path)
        .map_err(|e| format!("فشل قراءة ملف الصرف: {}", e))?;

    Dictionary::new(&aff_str, &dic_str)
        .map_err(|e| format!("فشل تحميل المدقق الإملائي: {}", e))
}

#[tauri::command]
fn check_spelling(app: tauri::AppHandle, state: tauri::State<'_, SpellcheckState>, text: String) -> Result<Vec<SpellError>, String> {
    let dict = {
        let mut d = state.dict.lock().map_err(|e| e.to_string())?;
        if d.is_none() {
            *d = Some(load_dictionary(&app)?);
        }
        d.as_ref().unwrap().clone()
    };

    let mut results: Vec<SpellError> = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for raw in text.split(|c: char| !c.is_alphanumeric() && c != '\'' && c != '\u{0621}') {
        let word = raw.trim();
        if word.is_empty() || word.len() < 2 { continue; }
        if !word.chars().any(|c| c >= '\u{0600}' && c <= '\u{06FF}') {
            continue;
        }
        if seen.insert(word.to_string()) {
            let w = word.to_string();
            if !dict.check(&w) {
                let mut suggestions = Vec::new();
                dict.suggest(&w, &mut suggestions);
                suggestions.truncate(5);
                results.push(SpellError { word: w, suggestions });
            }
        }
    }

    Ok(results)
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct SpellError {
    word: String,
    suggestions: Vec<String>,
}

// ── Hunspell spellcheck end ──────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(SpellcheckState { dict: Mutex::new(None) })
        .setup(|app| {
            let handle = app.handle();
            let default_ws = workspace_dir(handle);
            let _ = fs::create_dir_all(&default_ws);
            let store = handle
                .path()
                .app_config_dir()
                .map_err(|e| format!("config dir: {}", e))?
                .join("trusted-workspaces.json");
            let registry = WorkspaceRegistry::load(store, &default_ws);
            for root in registry.roots() {
                allow_asset_dir(handle, &root);
            }
            app.manage(registry);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_workspace_dir,
            pick_workspace,
            open_workspace,
            list_files,
            read_text_file,
            read_binary_file,
            write_text_file,
            create_dir,
            remove_file,
            rename_file,
            file_exists,
            export_pandoc,
            copy_file,
            copy_file_to_assets,
            list_assets,
            get_hadith_books,
            read_hadith_book,
            search_dictionary,
            list_dictionaries,
            check_spelling,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
