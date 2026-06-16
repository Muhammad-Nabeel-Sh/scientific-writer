import { invoke } from '@tauri-apps/api/core';
import type { TreeNode } from './stores';

let WORKSPACE_DIR: string;
let HIERARCHY_FILE: string;

export async function getWorkspaceDir(): Promise<string> {
  if (!WORKSPACE_DIR) {
    WORKSPACE_DIR = await invoke<string>('get_workspace_dir');
    HIERARCHY_FILE = `${WORKSPACE_DIR}/hierarchy.json`;
  }
  return WORKSPACE_DIR;
}

async function workspacePath(id: string): Promise<string> {
  const dir = await getWorkspaceDir();
  return `${dir}/${id}.md`;
}

export async function initWorkspace(): Promise<TreeNode[]> {
  const dir = await getWorkspaceDir();
  try {
    const content = await invoke<string>('read_text_file', { path: HIERARCHY_FILE });
    return JSON.parse(content) as TreeNode[];
  } catch {
    const defaultHierarchy: TreeNode[] = [
      {
        id: 'folder-a', name: 'Folder A', type: 'folder', expanded: true, children: [
          { id: 'note-1', name: 'Note1.md', type: 'note' },
          { id: 'note-2', name: 'Note2.md', type: 'note' }
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
