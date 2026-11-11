import { invoke, isTauri } from '@tauri-apps/api/core';
import type { TreeNode } from './stores';

let WORKSPACE_DIR: string;
let HIERARCHY_FILE: string;

const WORKSPACE_KEY = 'scientific_writer_workspace';

/**
 * The backend only lets the app touch folders the user has trusted (picked in
 * the native dialog or confirmed natively). A saved path that is no longer
 * trusted triggers that confirmation; if declined we fall back to the default.
 */
let resolving: Promise<string> | null = null;

export async function getWorkspaceDir(): Promise<string> {
  if (!isTauri()) {
    throw new Error('Tauri runtime not available. Run `npm run tauri dev` for the desktop app.');
  }
  if (WORKSPACE_DIR) return WORKSPACE_DIR;
  // Concurrent callers at startup share one resolution (one native prompt at most).
  if (!resolving) resolving = resolveWorkspaceDir().finally(() => { resolving = null; });
  return resolving;
}

async function resolveWorkspaceDir(): Promise<string> {
  {
    const saved = localStorage.getItem(WORKSPACE_KEY);
    let dir = '';
    if (saved) {
      try {
        dir = await invoke<string>('open_workspace', { path: saved });
      } catch (e) {
        console.warn('[workspace] saved workspace not opened:', e);
      }
    }
    if (!dir) {
      dir = await invoke<string>('get_workspace_dir');
      localStorage.setItem(WORKSPACE_KEY, dir);
    }
    await invoke('create_dir', { path: dir, recursive: true });
    await invoke('create_dir', { path: `${dir}/assets`, recursive: true });
    HIERARCHY_FILE = `${dir}/hierarchy.json`;
    WORKSPACE_DIR = dir;
  }
  return WORKSPACE_DIR;
}

export function clearWorkspaceCache() {
  WORKSPACE_DIR = '';
  resolving = null;
  HIERARCHY_FILE = '';
}

/** Native folder picker; the picked folder is trusted by the backend. */
export async function pickWorkspaceDir(): Promise<string | null> {
  return invoke<string | null>('pick_workspace');
}

/** Switch to `path`. Rejects if the user declines the native confirmation. */
export async function setWorkspaceDir(path: string): Promise<void> {
  const dir = await invoke<string>('open_workspace', { path });
  WORKSPACE_DIR = dir;
  HIERARCHY_FILE = `${WORKSPACE_DIR}/hierarchy.json`;
  localStorage.setItem(WORKSPACE_KEY, dir);
  path = dir;
  await invoke('create_dir', { path, recursive: true });
  await invoke('create_dir', { path: `${path}/assets`, recursive: true });
}


async function workspacePath(id: string): Promise<string> {
  const dir = await getWorkspaceDir();
  return `${dir}/${id}.md`;
}

/* ── Auto-recovery backups ── */

async function getBackupDir(): Promise<string> {
  const dir = await getWorkspaceDir();
  const backupDir = `${dir}/.backups`;
  await invoke('create_dir', { path: backupDir, recursive: true });
  return backupDir;
}

export async function backupNote(id: string, content: string): Promise<void> {
  if (!content.trim()) return;
  const backupDir = await getBackupDir();
  const ts = Date.now();
  const path = `${backupDir}/${id}_${ts}.md.bak`;
  await invoke('write_text_file', { path, content });
  // Keep only last 20 backups per note
  try {
    const backupDirPath = await getBackupDir();
    const list = await invoke<string[]>('list_files', { dir: backupDirPath });
    const noteBackups = list.filter(f => f.startsWith(id + '_')).sort();
    while (noteBackups.length > 20) {
      const old = noteBackups.shift()!;
      try { await invoke('remove_file', { path: `${backupDirPath}/${old}` }); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

export async function listBackups(noteId: string): Promise<string[]> {
  const backupDir = await getBackupDir();
  const list = await invoke<string[]>('list_files', { dir: backupDir });
  return list.filter(f => f.startsWith(noteId + '_')).sort().reverse();
}

export async function restoreBackup(noteId: string, backupFile: string): Promise<string> {
  const backupDir = await getBackupDir();
  return invoke<string>('read_text_file', { path: `${backupDir}/${backupFile}` });
}

export async function deleteAssetFile(filename: string): Promise<void> {
  const dir = await getWorkspaceDir();
  await invoke('remove_file', { path: `${dir}/assets/${filename}` });
}

export async function initWorkspace(workspacePath?: string): Promise<TreeNode[]> {
  let dir: string;
  if (workspacePath) {
    dir = workspacePath;
    HIERARCHY_FILE = `${dir}/hierarchy.json`;
  } else {
    dir = await getWorkspaceDir();
  }
  try {
    const content = await invoke<string>('read_text_file', { path: HIERARCHY_FILE });
    return JSON.parse(content) as TreeNode[];
  } catch {
    const defaultHierarchy: TreeNode[] = [
      {
        id: 'folder-a', name: 'Folder A', type: 'folder', expanded: true, children: [
          { id: 'note-1', name: 'Note1.md', type: 'note' },
          { id: 'note-2', name: 'Note2.md', type: 'note' },
          { id: 'note-4', name: 'مثال روابط.md', type: 'note' },
          { id: 'note-5', name: 'مستهدف الرابط.md', type: 'note' },
        ]
      },
      { id: 'folder-b', name: 'Folder B', type: 'folder' },
      { id: 'note-3', name: 'Note3.md', type: 'note' }
    ];
    await saveHierarchy(defaultHierarchy);
    await invoke('write_text_file', {
      path: `${dir}/note-1.md`,
      content: `# مقدمة\n\nهذا مثال على كتابة علمية عربية.\nيمكن استخدام Finite Element Analysis في دراسة الإجهادات.\n\n$$\nF = ma\n$$\n\n$$\n\\sigma = \\frac{F}{A}\n$$`
    });
    await invoke('write_text_file', {
      path: `${dir}/note-4.md`,
      content: `# مثال الروابط\n\nهذه الصفحة تحتوي على [[مستهدف الرابط]] و[[Note2]].\n\nيمكنك النقر على الرابط للانتقال إلى الصفحة المستهدفة.`
    });
    await invoke('write_text_file', {
      path: `${dir}/note-5.md`,
      content: `# مستهدف الرابط\n\nهذه الصفحة يستهدفها الرابط من [[مثال روابط]].\n\nعند عرض هذه الصفحة، ستظهر الروابط الواردة في اللوحة الجانبية.`
    });
    return defaultHierarchy;
  }
}

export async function saveHierarchy(nodes: TreeNode[]) {
  await invoke('write_text_file', {
    path: HIERARCHY_FILE,
    content: JSON.stringify(nodes, null, 2)
  });
}

export async function readNote(id: string): Promise<string> {
  try {
    const path = await workspacePath(id);
    return await invoke<string>('read_text_file', { path });
  } catch {
    return '';
  }
}

export async function copyFile(src: string, dest: string): Promise<void> {
  await invoke('copy_file', { src, dest });
}

export async function writeNote(id: string, content: string) {
  const path = await workspacePath(id);
  await invoke('write_text_file', { path, content });
}

export async function copyFileToAssets(
  workspace: string,
  fileName: string,
  data: number[],
): Promise<string> {
  return invoke<string>('copy_file_to_assets', { workspace, fileName, data });
}

export async function listAssets(workspace: string): Promise<string[]> {
  return invoke<string[]>('list_assets', { workspace });
}

export async function deleteNode(id: string) {
  const path = await workspacePath(id);
  await invoke('remove_file', { path });
}

export async function moveNote(oldId: string, newParentId: string) {
  // Simplified: just update hierarchy JSON. Actual file move handled by hierarchy sync.
}

export async function readBibliography(): Promise<string> {
  const dir = await getWorkspaceDir();
  try {
    return await invoke<string>('read_text_file', { path: `${dir}/references.bib` });
  } catch {
    return '';
  }
}

const BIB_TEMPLATE = `% references.bib — ملف المراجع العلمية
% أضف مراجعك هنا بصيغة BibTeX
% Add your references here in BibTeX format

% مثال - مقالة دورية / Journal article:
%@article{key2024,
%  author = {Last, First},
%  title = {Article Title},
%  journal = {Journal Name},
%  year = {2024},
%  volume = {10},
%  number = {2},
%  pages = {100--110}
%}

% مثال - كتاب / Book:
%@book{key2023,
%  author = {Last, First},
%  title = {Book Title},
%  publisher = {Publisher},
%  year = {2023}
%}

% مثال - مؤتمر / Conference paper:
%@inproceedings{key2022,
%  author = {Last, First},
%  title = {Paper Title},
%  booktitle = {Proceedings of the Conference},
%  year = {2022},
%  pages = {1--10}
%}
`;

export async function ensureBibliography(): Promise<string> {
  const content = await readBibliography();
  if (content) return content;
  const dir = await getWorkspaceDir();
  await invoke('write_text_file', { path: `${dir}/references.bib`, content: BIB_TEMPLATE });
  return BIB_TEMPLATE;
}

export async function writeBibliography(content: string): Promise<void> {
  const dir = await getWorkspaceDir();
  await invoke('write_text_file', { path: `${dir}/references.bib`, content });
}

/* ── Custom math symbols ({workspace}/math-symbols.json) ── */

const MATH_SYMBOLS_FILE = 'math-symbols.json';

/** Contents of the workspace's math-symbols.json, or null if it has none. */
export async function readMathSymbolsFile(): Promise<string | null> {
  const dir = await getWorkspaceDir();
  const path = `${dir}/${MATH_SYMBOLS_FILE}`;
  if (!(await invoke<boolean>('file_exists', { path }))) return null;
  return invoke<string>('read_text_file', { path });
}

export async function writeMathSymbolsFile(content: string): Promise<void> {
  const dir = await getWorkspaceDir();
  await invoke('write_text_file', { path: `${dir}/${MATH_SYMBOLS_FILE}`, content });
}
