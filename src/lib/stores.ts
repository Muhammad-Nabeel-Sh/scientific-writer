import { writable, derived } from 'svelte/store';
import { parseOutline } from './markdown';

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

import type { BibEntry } from './bibliography';
export const bibEntries = writable<BibEntry[]>([]);
export const citedKeys = writable<string[]>([]);
export const missingCitationKeys = writable<string[]>([]);
