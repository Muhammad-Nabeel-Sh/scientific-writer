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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
