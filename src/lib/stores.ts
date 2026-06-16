import { writable, derived } from 'svelte/store';

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
