import { writable, derived } from 'svelte/store';
import { parseOutline, type DigitStyle } from './markdown';

export interface TreeNode {
  id: string;
  name: string;
  type: 'folder' | 'note';
  children?: TreeNode[];
  expanded?: boolean;
}

export const hierarchy = writable<TreeNode[]>([]);
// Store a history stack for undo/redo on hierarchy
export const hierarchyHistory = writable<string[]>([]);
export const hierarchyHistoryIndex = writable<number>(-1);

export function pushHierarchySnapshot(nodes: TreeNode[]) {
  const json = JSON.stringify(nodes);
  hierarchyHistory.update(h => {
    let idx = -1;
    hierarchyHistoryIndex.subscribe(v => idx = v)();
    const newH = h.slice(0, idx + 1);
    newH.push(json);
    if (newH.length > 50) newH.shift();
    hierarchyHistoryIndex.set(newH.length - 1);
    return newH;
  });
}

export function undoHierarchy() {
  let idx = -1;
  hierarchyHistoryIndex.subscribe(v => idx = v)();
  if (idx <= 0) return;
  hierarchyHistoryIndex.set(idx - 1);
  hierarchyHistory.subscribe(h => {
    if (h[idx - 1]) hierarchy.set(JSON.parse(h[idx - 1]));
  })();
}

export function redoHierarchy() {
  let idx = -1;
  let hLen = 0;
  hierarchyHistoryIndex.subscribe(v => idx = v)();
  hierarchyHistory.subscribe(h => hLen = h.length)();
  if (idx >= hLen - 1) return;
  hierarchyHistoryIndex.set(idx + 1);
  hierarchyHistory.subscribe(h => {
    if (h[idx + 1]) hierarchy.set(JSON.parse(h[idx + 1]));
  })();
}

export const activeNoteId = writable<string | null>(null);
export const noteContent = writable<string>('');

/* ── Tabbed editing ── */
export interface Tab {
  id: string;
  name: string;
  content: string;
  dirty: boolean;
}

export const openTabs = writable<Map<string, Tab>>(new Map());
export const activeTabId = writable<string | null>(null);

export function openNoteTab(id: string, name: string, content: string) {
  openTabs.update(tabs => {
    if (!tabs.has(id)) {
      tabs.set(id, { id, name, content, dirty: false });
    }
    return tabs;
  });
  activeTabId.set(id);
}

export function closeNoteTab(id: string) {
  openTabs.update(tabs => {
    tabs.delete(id);
    return tabs;
  });
  activeTabId.update(current => {
    if (current === id) {
      let remaining: string[] = [];
      openTabs.subscribe(t => remaining = [...t.keys()])();
      return remaining[remaining.length - 1] || null;
    }
    return current;
  });
}

export function updateTabContent(id: string, content: string) {
  openTabs.update(tabs => {
    const tab = tabs.get(id);
    if (tab) {
      tab.content = content;
      tab.dirty = true;
    }
    return tabs;
  });
}

export function markTabClean(id: string) {
  openTabs.update(tabs => {
    const tab = tabs.get(id);
    if (tab) tab.dirty = false;
    return tabs;
  });
}

export function renameTab(id: string, newName: string) {
  openTabs.update(tabs => {
    const tab = tabs.get(id);
    if (tab) tab.name = newName;
    return tabs;
  });
}

export const openTabList = derived(openTabs, ($tabs) => [...$tabs.values()]);

export const isSaving = writable(false);

// Derived store for active note metadata
export const activeNote = derived([hierarchy, activeNoteId], ([$hierarchy, $id]) => {
  if (!$id) return null;
  const find = (nodes: TreeNode[]): TreeNode | null => {
    for (const node of nodes) {
      if (node.id === $id) return node;
      if (node.children) {
        const found = find(node.children);
        if (found) return found;
      }
    }
    return null;
  };
  return find($hierarchy);
});

export const editorRef = writable<HTMLTextAreaElement | null>(null);
export const previewRef = writable<HTMLElement | null>(null);
export const activeHeadingId = writable<string | null>(null);
export const outlineItems = derived(noteContent, ($c) => parseOutline($c));

export const endnoteMode = writable(false);

export const digitStyle = writable<DigitStyle>('auto');

export interface LigatureSettings {
  standard: boolean;
  required: boolean;
  discretionary: boolean;
}

export const ligatureSettings = writable<LigatureSettings>({
  standard: true,
  required: true,
  discretionary: false,
});

export interface FontSettings {
  family: string;
  weight: number;
  opticalSize: number;
  width: number;
  fontSize: number;
}

export const fontSettings = writable<FontSettings>({
  family: 'Amiri',
  weight: 400,
  opticalSize: 12,
  width: 100,
  fontSize: 16,
});

export interface KashidaConfig {
  enabled: boolean;
  targetFill: number;
}

export const kashidaConfig = writable<KashidaConfig>({
  enabled: false,
  targetFill: 0.92,
});

import type { BibEntry } from './bibliography';

export const bibEntries = writable<BibEntry[]>([]);
export const citedKeys = writable<string[]>([]);
export const missingCitationKeys = writable<string[]>([]);

/* ── Recent workspaces ── */

export const recentWorkspaces = writable<{ path: string; label: string }[]>([]);

export function loadRecentWorkspaces() {
  try {
    const raw = localStorage.getItem('scientific_writer_recent');
    if (raw) recentWorkspaces.set(JSON.parse(raw));
  } catch { /* ignore */ }
}

export function addRecentWorkspace(path: string, label?: string) {
  recentWorkspaces.update(list => {
    const filtered = list.filter(w => w.path !== path);
    const entry = { path, label: label || path.split(/[\\/]/).pop() || path };
    const updated = [entry, ...filtered].slice(0, 10);
    localStorage.setItem('scientific_writer_recent', JSON.stringify(updated));
    return updated;
  });
}

/* ── Auto-recovery backup ── */

export let lastBackupTime = 0;
export const BACKUP_INTERVAL = 120000; // 2 minutes

/* ── Export status ── */

export const exportStatus = writable<{ exporting: boolean; label: string; error?: string }>({
  exporting: false,
  label: '',
});

/* ── Keybindings (customizable) ── */

export interface Keybinding {
  id: string;
  label: string;
  keys: string;      // e.g. "ctrl+k"
  command: string;
  defaultKeys: string;
}

export const defaultBindings: Keybinding[] = [
  { id: 'undo', label: 'تراجع', keys: 'ctrl+z', command: 'undo', defaultKeys: 'ctrl+z' },
  { id: 'redo', label: 'إعادة', keys: 'ctrl+y', command: 'redo', defaultKeys: 'ctrl+y' },
  { id: 'save', label: 'حفظ', keys: 'ctrl+s', command: 'save', defaultKeys: 'ctrl+s' },
  { id: 'bold', label: 'عريض', keys: 'ctrl+b', command: 'bold', defaultKeys: 'ctrl+b' },
  { id: 'italic', label: 'مائل', keys: 'ctrl+i', command: 'italic', defaultKeys: 'ctrl+i' },
  { id: 'table', label: 'جدول', keys: 'ctrl+t', command: 'insertTable', defaultKeys: 'ctrl+t' },
  { id: 'link', label: 'رابط', keys: 'ctrl+l', command: 'insertLink', defaultKeys: 'ctrl+l' },
  { id: 'blockquote', label: 'اقتباس', keys: 'ctrl+q', command: 'blockquote', defaultKeys: 'ctrl+q' },
  { id: 'quickOpen', label: 'بحث سريع', keys: 'ctrl+p', command: 'quickOpen', defaultKeys: 'ctrl+p' },
  { id: 'search', label: 'بحث', keys: 'ctrl+shift+f', command: 'search', defaultKeys: 'ctrl+shift+f' },
  { id: 'newNote', label: 'ملاحظة جديدة', keys: 'ctrl+n', command: 'newNote', defaultKeys: 'ctrl+n' },
  { id: 'closeTab', label: 'إغلاق علامة التبويب', keys: 'ctrl+w', command: 'closeTab', defaultKeys: 'ctrl+w' },
];

export const keybindings = writable<Keybinding[]>(defaultBindings);

export function loadKeybindings() {
  try {
    const raw = localStorage.getItem('scientific_writer_keys');
    if (raw) keybindings.set(JSON.parse(raw));
  } catch { /* ignore */ }
}

export function saveKeybinding(updated: Keybinding) {
  keybindings.update(list => {
    const idx = list.findIndex(k => k.id === updated.id);
    if (idx >= 0) list[idx] = updated;
    localStorage.setItem('scientific_writer_keys', JSON.stringify(list));
    return list;
  });
}

export function resetKeybindings() {
  keybindings.set(defaultBindings);
  localStorage.removeItem('scientific_writer_keys');
}

/* ── Backlinks ── */

import { findNodeInHierarchy } from './backlinks';

export const backlinksIndex = writable<Map<string, string[]>>(new Map());

export const currentBacklinks = derived(
  [backlinksIndex, activeNoteId, hierarchy],
  ([$index, $id, $hierarchy]) => {
    if (!$id || !$index.has($id)) return [];
    const sourceIds = $index.get($id)!;
    return sourceIds.map((sourceId) => {
      const node = findNodeInHierarchy($hierarchy, sourceId);
      return {
        id: sourceId,
        name: node?.name.replace(/\.md$/i, '') || sourceId,
      };
    });
  },
);
