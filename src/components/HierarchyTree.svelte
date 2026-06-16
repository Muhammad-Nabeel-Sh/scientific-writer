<script lang="ts">
  import { hierarchy, activeNoteId } from '$lib/stores';
  import type { TreeNode } from '$lib/stores';
  import { createId } from '$lib/utils';
  import { saveHierarchy } from '$lib/fs';
  import TreeItem from './TreeItem.svelte';

  $: nodes = $hierarchy;

  function save() {
    saveHierarchy([...$hierarchy]);
  }

  function selectNote(id: string) {
    $activeNoteId = id;
  }

  function renameNode(node: TreeNode) {
    const newName = prompt('إعادة تسمية:', node.name);
    if (newName && newName.trim()) {
      node.name = newName.trim();
      $hierarchy = [...$hierarchy];
      save();
    }
  }

  function deleteNode(node: TreeNode) {
    if (!confirm(`حذف ${node.name}؟`)) return;
    const remove = (list: TreeNode[]): TreeNode[] =>
      list.filter((n) => {
        if (n.id === node.id) return false;
        if (n.children) n.children = remove(n.children);
        return true;
      });
    $hierarchy = remove([...$hierarchy]);
    if ($activeNoteId === node.id) $activeNoteId = null;
    save();
  }

  function addNote(parentId?: string) {
    const id = createId();
    const newNote: TreeNode = { id, name: 'ملاحظة جديدة.md', type: 'note' };
    if (parentId) {
      const ins = (list: TreeNode[]): boolean => {
        for (const n of list) {
          if (n.id === parentId && n.type === 'folder') {
            n.children = [...(n.children || []), newNote];
            return true;
          }
          if (n.children && ins(n.children)) return true;
        }
        return false;
      };
      ins($hierarchy);
    } else {
      $hierarchy = [...$hierarchy, newNote];
    }
    $activeNoteId = id;
    $hierarchy = [...$hierarchy];
    save();
  }

  function addFolder() {
    const id = createId();
    const folder: TreeNode = { id, name: 'مجلد جديد', type: 'folder', expanded: true, children: [] };
    $hierarchy = [...$hierarchy, folder];
    save();
  }

  function moveNode(nodeId: string, targetId: string, position: 'before' | 'after' | 'inside') {
    const findParent = (list: TreeNode[], id: string): { list: TreeNode[]; idx: number } | null => {
      for (let i = 0; i < list.length; i++) {
        if (list[i].id === id) return { list, idx: i };
        if (list[i].children) {
          const r = findParent(list[i].children!, id);
          if (r) return r;
        }
      }
      return null;
    };

    const src = findParent($hierarchy, nodeId);
    const dst = findParent($hierarchy, targetId);
    if (!src || !dst) return;
    const [node] = src.list.splice(src.idx, 1);
    if (position === 'inside') {
      const target = dst.list[dst.idx];
      if (target.type !== 'folder') return;
      target.children = [...(target.children || []), node];
    } else {
      const insertAt = position === 'before' ? dst.idx : dst.idx + 1;
      dst.list.splice(insertAt, 0, node);
    }
    $hierarchy = [...$hierarchy];
    save();
  }
</script>

<div class="tree-container tree-scroll">
  <div class="tree-actions">
    <button class="tree-action-btn" title="ملاحظة جديدة" on:click={() => addNote()}>
      <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
    </button>
    <button class="tree-action-btn" title="مجلد جديد" on:click={addFolder}>
      <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" /></svg>
    </button>
  </div>
  {#each nodes as node (node.id)}
    <TreeItem {node} {selectNote} {renameNode} {deleteNode} {addNote} {moveNode} />
  {:else}
    <div class="empty-msg">لا توجد ملاحظات</div>
  {/each}
</div>

<style>
  .tree-container { display: flex; flex-direction: column; gap: 2px; }
  .tree-container.tree-scroll { overflow-y: auto; overflow-x: hidden; flex: 1; }
  .tree-actions { display: flex; gap: 4px; margin-bottom: 8px; }
  .tree-action-btn {
    background: none; border: 1px solid var(--border); color: var(--fg-muted);
    cursor: pointer; padding: 4px 8px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s, color 0.15s;
  }
  .tree-action-btn:hover { background: var(--bg-hover); color: var(--fg); }
  .tree-action-btn svg { width: 18px; height: 18px; }
  .empty-msg { color: var(--fg-muted); font-size: 0.9rem; padding: 1rem; text-align: center; }
</style>
