mod workspace;

use rusqlite::Connection;
use serde::Serialize;
use spellbook::Dictionary;
use std::fs;
use std::path::{Component, Path, PathBuf};
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

/// Asset names must be a single file name: no separators, drive prefixes,
/// `..`, NUL, alternate data streams, or Windows device names.
fn validate_file_name(file_name: &str) -> Result<String, String> {
    if file_name.is_empty()
        || file_name.contains('\0')
        || file_name.contains(':')
        || file_name.contains('/')
        || file_name.contains('\\')
    {
        return Err("اسم ملف غير صالح".to_string());
    }

    let mut components = Path::new(file_name).components();
    let Some(Component::Normal(name)) = components.next() else {
        return Err("اسم ملف غير صالح".to_string());
    };
    if components.next().is_some() {
        return Err("اسم ملف غير صالح: يجب أن يكون اسمًا واحدًا بدون مسارات".to_string());
    }
    let name = name
        .to_str()
        .ok_or_else(|| "اسم ملف غير صالح".to_string())?;
    if name == "." || name == ".." || name != name.trim() || name.ends_with('.') {
        return Err("اسم ملف غير صالح".to_string());
    }
    if is_reserved_windows_name(name) {
        return Err("اسم ملف محجوز في النظام".to_string());
    }
    Ok(name.to_string())
}

fn is_reserved_windows_name(name: &str) -> bool {
    let stem = name.split('.').next().unwrap_or(name).to_ascii_uppercase();
    matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || (stem.len() == 4
            && (stem.starts_with("COM") || stem.starts_with("LPT"))
            && stem.as_bytes()[3].is_ascii_digit()
            && stem.as_bytes()[3] != b'0')
}

#[tauri::command]
fn copy_file_to_assets(ws: Ws, workspace: String, file_name: String, data: Vec<u8>) -> Result<String, String> {
    let file_name = validate_file_name(&file_name)?;
    let assets_dir = ws.resolve(&workspace)?.join("assets");
    fs::create_dir_all(&assets_dir).map_err(|e| format!("mkdir assets: {}", e))?;
    let dest = ws.resolve(&assets_dir.join(&file_name).to_string_lossy())?;
    write_atomic(&dest, &data)?;
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
async fn read_binary_file(app: tauri::AppHandle, path: String) -> Result<Vec<u8>, String> {
    let path = app.state::<WorkspaceRegistry>().resolve(&path)?;
    tauri::async_runtime::spawn_blocking(move || {
        fs::read(&path).map_err(|e| format!("read binary: {}", e))
    })
    .await
    .map_err(|e| format!("read binary task: {}", e))?
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

fn find_pandoc(app: &tauri::AppHandle) -> String {
    // Look for a bundled pandoc next to the app executable first,
    // then fall back to system PATH.
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

fn normalize_export_format(format: &str) -> Result<String, String> {
    let normalized = format.to_ascii_lowercase();
    match normalized.as_str() {
        "docx" | "odt" | "epub" | "html" => Ok(normalized),
        _ => Err(format!("صيغة تصدير غير مدعومة: {}", format)),
    }
}

fn export_pandoc_blocking(
    pandoc_bin: String,
    workspace_path: PathBuf,
    in_path: PathBuf,
    out_path: PathBuf,
    markdown: String,
) -> Result<Vec<u8>, String> {
    use std::process::Command;

    fs::write(&in_path, &markdown).map_err(|e| format!("write md error: {}", e))?;

    let output = match Command::new(&pandoc_bin)
        .current_dir(&workspace_path)
        .arg(&in_path)
        .arg("-o")
        .arg(&out_path)
        .output()
    {
        Ok(output) => output,
        Err(e) => {
            let _ = fs::remove_file(&in_path);
            return Err(format!(
                "Pandoc not found. Please install Pandoc (https://pandoc.org/installing.html) or place pandoc.exe next to the application. Error: {}",
                e
            ));
        }
    };

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        let _ = fs::remove_file(&in_path);
        let _ = fs::remove_file(&out_path);
        return Err(format!("Pandoc error: {}", err));
    }

    let bytes = match fs::read(&out_path) {
        Ok(bytes) => bytes,
        Err(e) => {
            let _ = fs::remove_file(&in_path);
            let _ = fs::remove_file(&out_path);
            return Err(format!("read output error: {}", e));
        }
    };

    let _ = fs::remove_file(&in_path);
    let _ = fs::remove_file(&out_path);

    Ok(bytes)
}

#[tauri::command]
async fn export_pandoc(
    app: tauri::AppHandle,
    workspace: String,
    markdown: String,
    format: String,
) -> Result<Vec<u8>, String> {
    let format = normalize_export_format(&format)?;
    let pandoc_bin = find_pandoc(&app);
    let ws_path = app.state::<WorkspaceRegistry>().resolve(&workspace)?;
    let in_path = ws_path.join(".temp_export.md");
    let out_path = ws_path.join(format!(".temp_export.{}", format));

    tauri::async_runtime::spawn_blocking(move || {
        export_pandoc_blocking(pandoc_bin, ws_path, in_path, out_path, markdown)
    })
    .await
    .map_err(|e| format!("export task: {}", e))?
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
async fn read_hadith_book(app: tauri::AppHandle, book: String) -> Result<String, String> {
    if !HADITH_BOOKS.contains(&book.as_str()) {
        return Err(format!("unknown book: {}", book));
    }
    // Bundled as `hadith/<book>.json` (see tauri.conf.json bundle.resources).
    let path = resource_path(
        &app,
        &format!("hadith/{}.json", book),
        &format!("docs/hadith-json-1.2.0/db/by_book/the_9_books/{}.json", book),
    );
    tauri::async_runtime::spawn_blocking(move || {
        fs::read_to_string(&path).map_err(|e| format!("read hadith {:?}: {}", path, e))
    })
    .await
    .map_err(|e| format!("hadith task: {}", e))?
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

fn search_dictionary_blocking(
    db_path: PathBuf,
    query: &str,
    dict_table: Option<&str>,
    search_mode: Option<&str>,
    dict_group: Option<&str>,
) -> Result<Vec<DictEntry>, String> {
    let conn =
        Connection::open(&db_path).map_err(|e| format!("open db {:?}: {}", db_path, e))?;

    let search_by_root = search_mode == Some("root");

    let dicts: Vec<&(&str, &str, &str, &str)> = match dict_table {
        Some(table) => {
            let matched: Vec<_> = DICTS.iter().filter(|(t, _, _, _)| *t == table).collect();
            if matched.is_empty() {
                return Err(format!("unknown dictionary: {}", table));
            }
            matched
        }
        None => match dict_group.unwrap_or("all") {
            "ar" => DICTS.iter().filter(|(_, _, _, g)| *g == "ar").collect(),
            "ar_en" => DICTS.iter().filter(|(_, _, _, g)| *g == "ar_en").collect(),
            _ => DICTS.iter().collect(),
        },
    };

    let mut all = Vec::new();
    for (table, _, _, _) in dicts {
        let results = search_dict(&conn, query, table, search_by_root)?;
        all.extend(results);
    }
    all.sort_by(|a, b| a.word.cmp(&b.word));
    all.truncate(60);
    Ok(all)
}

#[tauri::command]
async fn search_dictionary(
    app: tauri::AppHandle,
    query: String,
    dict_table: Option<String>,
    search_mode: Option<String>,   // "word" | "root", default "word"
    dict_group: Option<String>,    // "all" | "ar" | "ar_en", default "all"
) -> Result<Vec<DictEntry>, String> {
    let db_path = dict_db_path(&app);
    tauri::async_runtime::spawn_blocking(move || {
        search_dictionary_blocking(
            db_path,
            &query,
            dict_table.as_deref(),
            search_mode.as_deref(),
            dict_group.as_deref(),
        )
    })
    .await
    .map_err(|e| format!("dictionary task: {}", e))?
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

fn check_spelling_blocking(app: &tauri::AppHandle, text: &str) -> Result<Vec<SpellError>, String> {
    let state = app.state::<SpellcheckState>();
    let mut guard = state.dict.lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        *guard = Some(load_dictionary(app)?);
    }
    let dict = guard.as_ref().unwrap();

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

#[tauri::command]
async fn check_spelling(app: tauri::AppHandle, text: String) -> Result<Vec<SpellError>, String> {
    tauri::async_runtime::spawn_blocking(move || check_spelling_blocking(&app, &text))
        .await
        .map_err(|e| format!("spellcheck task: {}", e))?
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_asset_file_names() {
        assert_eq!(validate_file_name("image.png").unwrap(), "image.png");
        assert_eq!(validate_file_name("صورة-1.png").unwrap(), "صورة-1.png");
        assert_eq!(validate_file_name(".hidden").unwrap(), ".hidden");

        for bad in [
            "",
            ".",
            "..",
            "../x",
            "a/b.png",
            "a\\b.png",
            "/abs.png",
            "C:\\x.png",
            "C:x.png",
            "stream:name",
            "bad\0name",
            "trailing.",
            " leading",
            "trailing ",
        ] {
            assert!(validate_file_name(bad).is_err(), "accepted {bad:?}");
        }
    }

    #[test]
    fn rejects_windows_reserved_file_names() {
        for bad in ["CON", "con.png", "COM1.txt", "LPT9.log"] {
            assert!(validate_file_name(bad).is_err(), "accepted {bad:?}");
        }
        for ok in ["COM0.txt", "CONSOLE.txt", "LPT0.log"] {
            assert!(validate_file_name(ok).is_ok(), "rejected {ok:?}");
        }
    }

    #[test]
    fn normalizes_only_supported_export_formats() {
        for (input, expected) in [
            ("docx", "docx"),
            ("DOCX", "docx"),
            ("odt", "odt"),
            ("epub", "epub"),
            ("html", "html"),
        ] {
            assert_eq!(normalize_export_format(input).unwrap(), expected);
        }
        for bad in ["pdf", "", "docx ", " docx", "../docx", "docx\0"] {
            assert!(normalize_export_format(bad).is_err(), "accepted {bad:?}");
        }
    }
}
