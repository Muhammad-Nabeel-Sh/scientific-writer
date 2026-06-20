use rusqlite::Connection;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

fn workspace_dir(app: &tauri::AppHandle) -> PathBuf {
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");
    data_dir.join("scientific-writer").join("workspace")
}

#[tauri::command]
fn copy_file_to_assets(workspace: String, file_name: String, data: Vec<u8>) -> Result<String, String> {
    let assets_dir = Path::new(&workspace).join("assets");
    fs::create_dir_all(&assets_dir).map_err(|e| format!("mkdir assets: {}", e))?;
    let dest = assets_dir.join(&file_name);
    fs::write(&dest, &data).map_err(|e| format!("write: {}", e))?;
    Ok(format!("assets/{}", file_name))
}

#[tauri::command]
fn list_assets(workspace: String) -> Result<Vec<String>, String> {
    let assets_dir = Path::new(&workspace).join("assets");
    if !assets_dir.exists() {
        return Ok(vec![]);
    }
    let mut entries = fs::read_dir(&assets_dir).map_err(|e| format!("read_dir: {}", e))?;
    let mut files = vec![];
    while let Some(entry) = entries.next().transpose().map_err(|e| format!("entry: {}", e))? {
        if entry.file_type().map_err(|e| format!("ftype: {}", e))?.is_file() {
            if let Some(name) = entry.file_name().to_str() {
                files.push(name.to_string());
            }
        }
    }
    files.sort();
    Ok(files)
}

fn project_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("failed to resolve project root")
        .to_path_buf()
}

#[tauri::command]
fn get_workspace_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = workspace_dir(&app);
    fs::create_dir_all(&dir).map_err(|e| format!("mkdir: {}", e))?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("read: {}", e))
}

#[tauri::command]
fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("read binary: {}", e))
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir parent: {}", e))?;
    }
    fs::write(&path, &content).map_err(|e| format!("write: {}", e))
}

#[tauri::command]
fn create_dir(path: String, recursive: bool) -> Result<(), String> {
    if recursive {
        fs::create_dir_all(&path).map_err(|e| format!("mkdir: {}", e))
    } else {
        fs::create_dir(&path).map_err(|e| format!("mkdir: {}", e))
    }
}

#[tauri::command]
fn remove_file(path: String) -> Result<(), String> {
    fs::remove_file(&path).map_err(|e| format!("remove: {}", e))
}

#[tauri::command]
fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| format!("rename: {}", e))
}

#[tauri::command]
fn file_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
fn export_pandoc(app: tauri::AppHandle, workspace: String, markdown: String, format: String) -> Result<Vec<u8>, String> {
    use std::process::Command;

    // Look for a bundled pandoc next to the app executable first,
    // then fall back to system PATH.
    fn find_pandoc(app: &tauri::AppHandle) -> String {
        // Check next to the running executable
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                let bundled = dir.join("pandoc.exe");
                if bundled.exists() {
                    return bundled.to_string_lossy().to_string();
                }
            }
        }
        // Check Tauri resource dir (for production builds)
        if let Ok(res_dir) = app.path().resource_dir() {
            let bundled = res_dir.join("pandoc.exe");
            if bundled.exists() {
                return bundled.to_string_lossy().to_string();
            }
        }
        // Fall back to system PATH
        "pandoc".to_string()
    }

    let pandoc_bin = find_pandoc(&app);

    let ws_path = Path::new(&workspace);
    let in_path = ws_path.join(".temp_export.md");
    let out_path = ws_path.join(format!(".temp_export.{}", format));

    fs::write(&in_path, &markdown).map_err(|e| format!("write md error: {}", e))?;

    let output = Command::new(&pandoc_bin)
        .current_dir(&workspace)
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

#[tauri::command]
fn copy_file(src: String, dest: String) -> Result<(), String> {
    let data = fs::read(&src).map_err(|e| format!("read src: {}", e))?;
    if let Some(parent) = Path::new(&dest).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir: {}", e))?;
    }
    fs::write(&dest, &data).map_err(|e| format!("write dest: {}", e))
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
fn read_hadith_book(book: String) -> Result<String, String> {
    if !HADITH_BOOKS.contains(&book.as_str()) {
        return Err(format!("unknown book: {}", book));
    }
    let path = project_root().join(format!(
        "docs/hadith-json-1.2.0/db/by_book/the_9_books/{}.json",
        book
    ));
    fs::read_to_string(&path).map_err(|e| format!("read hadith: {}", e))
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}!")
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

fn dict_db_path(app: Option<&tauri::AppHandle>) -> PathBuf {
    if let Some(app) = app {
        if let Ok(resource_dir) = app.path().resource_dir() {
            let path = resource_dir.join("db/dicts.sqlite");
            if path.exists() {
                return path;
            }
        }
    }
    // Development fallback: project_root() -> parent of src-tauri/
    project_root().join("src-tauri/db/dicts.sqlite")
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
    let db_path = dict_db_path(Some(&app));
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
fn debug_dictionary_path(app: tauri::AppHandle) -> Result<String, String> {
    let resource_info = match app.path().resource_dir() {
        Ok(dir) => {
            let p = dir.join("db/dicts.sqlite");
            format!("{:?} (exists: {})", p, p.exists())
        }
        Err(e) => format!("error: {}", e),
    };
    let dev_path = project_root().join("src-tauri/db/dicts.sqlite");
    Ok(format!(
        "resource: {}\ndev: {:?} (exists: {})",
        resource_info,
        dev_path,
        dev_path.exists(),
    ))
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_workspace_dir,
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
            debug_dictionary_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
