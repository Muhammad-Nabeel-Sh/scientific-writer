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
fn copy_file(src: String, dest: String) -> Result<(), String> {
    let data = fs::read(&src).map_err(|e| format!("read src: {}", e))?;
    if let Some(parent) = Path::new(&dest).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir: {}", e))?;
    }
    fs::write(&dest, &data).map_err(|e| format!("write dest: {}", e))
}

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_workspace_dir,
            read_text_file,
            write_text_file,
            create_dir,
            remove_file,
            rename_file,
            file_exists,
            copy_file,
            copy_file_to_assets,
            list_assets,
            get_hadith_books,
            read_hadith_book,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
