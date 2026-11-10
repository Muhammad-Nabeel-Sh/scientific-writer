//! Workspace-scoped file access.
//!
//! Every file command coming from the webview must resolve its path through
//! [`WorkspaceRegistry::resolve`]. A path is accepted only when it is absolute,
//! contains no `..` component, and — after following symlinks of its deepest
//! existing ancestor — lies inside one of the *trusted* workspace roots.
//!
//! A root becomes trusted only through an action the webview cannot forge:
//! the default app-data workspace, a folder the user picked in the native
//! folder dialog, or a native confirmation dialog the user accepted.
//! The trusted list is persisted by the backend (not in `localStorage`).

use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

pub struct WorkspaceRegistry {
    /// Canonicalised trusted roots.
    roots: Mutex<Vec<PathBuf>>,
    /// Where the trusted list is persisted (JSON array of strings).
    store_path: PathBuf,
}

impl WorkspaceRegistry {
    /// Load the persisted trusted roots and always include `default_root`.
    pub fn load(store_path: PathBuf, default_root: &Path) -> Self {
        let mut roots: Vec<PathBuf> = fs::read_to_string(&store_path)
            .ok()
            .and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok())
            .unwrap_or_default()
            .into_iter()
            .filter_map(|p| fs::canonicalize(p).ok())
            .collect();
        if let Ok(def) = fs::canonicalize(default_root) {
            if !roots.contains(&def) {
                roots.push(def);
            }
        }
        Self { roots: Mutex::new(roots), store_path }
    }

    pub fn roots(&self) -> Vec<PathBuf> {
        self.roots.lock().map(|r| r.clone()).unwrap_or_default()
    }

    pub fn is_trusted(&self, dir: &Path) -> bool {
        match fs::canonicalize(dir) {
            Ok(c) => self.roots().iter().any(|r| *r == c),
            Err(_) => false,
        }
    }

    /// Add `dir` (must exist) to the trusted roots and persist the list.
    pub fn trust(&self, dir: &Path) -> Result<PathBuf, String> {
        let canon = fs::canonicalize(dir).map_err(|e| format!("مجلد غير صالح: {}", e))?;
        if !canon.is_dir() {
            return Err("المسار المحدد ليس مجلدًا".into());
        }
        let snapshot = {
            let mut roots = self.roots.lock().map_err(|e| e.to_string())?;
            if !roots.contains(&canon) {
                roots.push(canon.clone());
            }
            roots.clone()
        };
        let list: Vec<String> = snapshot.iter().map(|p| p.to_string_lossy().to_string()).collect();
        if let Some(parent) = self.store_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let json = serde_json::to_string_pretty(&list).map_err(|e| e.to_string())?;
        write_atomic(&self.store_path, json.as_bytes())?;
        Ok(canon)
    }

    /// Resolve a webview-supplied path, rejecting anything outside trusted roots.
    pub fn resolve(&self, raw: &str) -> Result<PathBuf, String> {
        resolve_within(&self.roots(), Path::new(raw))
    }
}

/// Core path check, kept free of Tauri types so it can be unit-tested.
pub fn resolve_within(roots: &[PathBuf], raw: &Path) -> Result<PathBuf, String> {
    let denied = || format!("الوصول مرفوض: المسار خارج مساحة العمل ({})", raw.display());

    if raw.as_os_str().is_empty() || !raw.is_absolute() {
        return Err(denied());
    }
    if raw.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err(denied());
    }

    // Canonicalise the deepest existing ancestor (follows symlinks), then
    // re-append the not-yet-existing tail (which cannot contain `..`).
    let mut existing = raw.to_path_buf();
    let mut tail: Vec<std::ffi::OsString> = Vec::new();
    while !existing.exists() {
        match (existing.file_name(), existing.parent()) {
            (Some(name), Some(parent)) => {
                tail.push(name.to_os_string());
                existing = parent.to_path_buf();
            }
            _ => return Err(denied()),
        }
    }
    let mut resolved = fs::canonicalize(&existing).map_err(|_| denied())?;
    for part in tail.iter().rev() {
        resolved.push(part);
    }

    if roots.iter().any(|root| resolved.starts_with(root)) {
        Ok(resolved)
    } else {
        Err(denied())
    }
}

/// Write via a sibling temp file and rename, so a crash never leaves a
/// truncated file behind.
pub fn write_atomic(path: &Path, data: &[u8]) -> Result<(), String> {
    let file_name = path
        .file_name()
        .ok_or_else(|| "اسم ملف غير صالح".to_string())?
        .to_string_lossy()
        .to_string();
    let tmp = path.with_file_name(format!(".{}.tmp", file_name));
    fs::write(&tmp, data).map_err(|e| format!("write: {}", e))?;
    fs::rename(&tmp, path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("rename: {}", e)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static COUNTER: AtomicUsize = AtomicUsize::new(0);

    /// Fresh temp dir per test: <tmp>/sw-ws-test-<pid>-<n>/{root,outside}
    fn setup() -> (PathBuf, PathBuf, PathBuf) {
        let n = COUNTER.fetch_add(1, Ordering::SeqCst);
        let base = std::env::temp_dir().join(format!("sw-ws-test-{}-{}", std::process::id(), n));
        let _ = fs::remove_dir_all(&base);
        let root = base.join("root");
        let outside = base.join("outside");
        fs::create_dir_all(root.join("assets")).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(outside.join("secret.txt"), "x").unwrap();
        (base, fs::canonicalize(&root).unwrap(), fs::canonicalize(&outside).unwrap())
    }

    #[test]
    fn accepts_existing_and_new_files_inside_root() {
        let (_b, root, _o) = setup();
        let roots = vec![root.clone()];
        assert!(resolve_within(&roots, &root.join("assets")).is_ok());
        let new_file = resolve_within(&roots, &root.join("note.md")).unwrap();
        assert!(new_file.starts_with(&root));
        // nested, not-yet-existing directories are fine too
        assert!(resolve_within(&roots, &root.join(".backups").join("a.bak")).is_ok());
    }

    #[test]
    fn rejects_parent_dir_escapes() {
        let (_b, root, _o) = setup();
        let roots = vec![root.clone()];
        let escape = root.join("assets").join("..").join("..").join("outside").join("secret.txt");
        assert!(resolve_within(&roots, &escape).is_err());
        assert!(resolve_within(&roots, &root.join("..")).is_err());
    }

    #[test]
    fn rejects_absolute_paths_outside_root() {
        let (_b, root, outside) = setup();
        let roots = vec![root];
        assert!(resolve_within(&roots, &outside.join("secret.txt")).is_err());
        assert!(resolve_within(&roots, &outside.join("new.txt")).is_err());
    }

    #[test]
    fn rejects_relative_and_empty_paths() {
        let (_b, root, _o) = setup();
        let roots = vec![root];
        assert!(resolve_within(&roots, Path::new("note.md")).is_err());
        assert!(resolve_within(&roots, Path::new("")).is_err());
    }

    #[test]
    fn rejects_sibling_with_common_prefix() {
        // "<base>/root-evil" must not pass as inside "<base>/root"
        let (base, root, _o) = setup();
        let evil = base.join("root-evil");
        fs::create_dir_all(&evil).unwrap();
        assert!(resolve_within(&[root], &evil.join("x.md")).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_pointing_outside() {
        let (_b, root, outside) = setup();
        std::os::unix::fs::symlink(&outside, root.join("link")).unwrap();
        assert!(resolve_within(&[root.clone()], &root.join("link").join("secret.txt")).is_err());
    }

    #[cfg(windows)]
    #[test]
    fn rejects_junction_pointing_outside() {
        // Directory symlinks need privileges on Windows; a junction does not.
        let (_b, root, outside) = setup();
        let link = root.join("link");
        let status = std::process::Command::new("cmd")
            .args(["/C", "mklink", "/J"])
            .arg(&link)
            .arg(&outside)
            .output();
        if status.map(|o| o.status.success()).unwrap_or(false) {
            assert!(resolve_within(&[root.clone()], &link.join("secret.txt")).is_err());
        }
    }

    #[test]
    fn registry_trust_persists_and_resolves() {
        let (base, root, outside) = setup();
        let store = base.join("cfg").join("trusted.json");
        let reg = WorkspaceRegistry::load(store.clone(), &root);
        assert!(reg.is_trusted(&root));
        assert!(!reg.is_trusted(&outside));
        assert!(reg.resolve(&outside.join("secret.txt").to_string_lossy()).is_err());

        reg.trust(&outside).unwrap();
        assert!(reg.resolve(&outside.join("secret.txt").to_string_lossy()).is_ok());

        // reload from disk
        let reg2 = WorkspaceRegistry::load(store, &root);
        assert!(reg2.is_trusted(&outside));
    }

    #[test]
    fn write_atomic_replaces_content() {
        let (_b, root, _o) = setup();
        let p = root.join("a.md");
        write_atomic(&p, b"one").unwrap();
        write_atomic(&p, b"two").unwrap();
        assert_eq!(fs::read_to_string(&p).unwrap(), "two");
        assert!(!root.join(".a.md.tmp").exists());
    }
}
