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
export const activeNoteId = writable<string | null>(null);
export const noteContent = writable<string>('');
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
