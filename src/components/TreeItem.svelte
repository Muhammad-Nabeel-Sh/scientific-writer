<script lang="ts">
  import { activeNoteId } from '$lib/stores';
  import type { TreeNode } from '$lib/stores';

  export let node: TreeNode;
  export let selectNote: (id: string) => void;
  export let renameNode: (n: TreeNode) => void;
  export let deleteNode: (n: TreeNode) => void;
  export let addNote: (parentId: string) => void;
  export let moveNode: (nodeId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;

  let dragOver = false;
  let dragPos: 'before' | 'after' | 'inside' | null = null;
  let itemEl: HTMLDivElement;

  $: isActive = $activeNoteId === node.id;

  function handleDragStart(e: DragEvent) {
    e.dataTransfer?.setData('text/plain', node.id);
    e.dataTransfer!.effectAllowed = 'move';
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (!itemEl) return;
    const rect = itemEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    if (y < h * 0.25) {
      dragPos = 'before';
    } else if (y > h * 0.75) {
      dragPos = 'after';
    } else if (node.type === 'folder') {
      dragPos = 'inside';
    } else {
      dragPos = 'after';
    }
    dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
    dragPos = null;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const draggedId = e.dataTransfer?.getData('text/plain');
    if (draggedId && dragPos && draggedId !== node.id) {
      moveNode(draggedId, node.id, dragPos);
    }
    dragPos = null;
  }

  function toggleExpand() {
    if (node.type === 'folder') node.expanded = !node.expanded;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="tree-item"
  class:active={isActive}
  class:drag-over={dragOver}
  class:drag-before={dragOver && dragPos === 'before'}
  class:drag-after={dragOver && dragPos === 'after'}
  class:drag-inside={dragOver && dragPos === 'inside'}
  draggable="true"
  bind:this={itemEl}
  on:dragstart={handleDragStart}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
>
  <button class="toggle" on:click={toggleExpand}>
    {node.type === 'folder' ? (node.expanded ? '▼' : '▶') : '📄'}
  </button>
  <span
    class="label"
    role="button"
    tabindex="0"
    on:click={() => node.type === 'note' && selectNote(node.id)}
    on:dblclick={() => renameNode(node)}
    on:keydown={(e) => e.key === 'Enter' && node.type === 'note' && selectNote(node.id)}
  >
    {node.name}
  </span>
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div class="actions" on:click|stopPropagation>
    {#if node.type === 'folder'}
      <button class="act" title="إضافة ملاحظة" on:click={() => addNote(node.id)}>+</button>
    {/if}
    <button class="act" title="حذف" on:click={() => deleteNode(node)}>🗑</button>
  </div>
</div>

{#if node.type === 'folder' && node.expanded && node.children}
  <div class="children">
    {#each node.children as child (child.id)}
      <svelte:self node={child} {selectNote} {renameNode} {deleteNode} {addNote} {moveNode} />
    {/each}
  </div>
{/if}

<style>
  .tree-item {
    display: flex; align-items: center; gap: 6px; padding: 6px 8px;
    border-radius: 6px; cursor: pointer; transition: background 0.15s;
    position: relative;
  }
  .tree-item:hover { background: var(--bg-hover); }
  .tree-item.active { background: var(--accent); color: #fff; }
  .tree-item.drag-over.drag-before { border-top: 2px solid var(--accent); }
  .tree-item.drag-over.drag-after { border-bottom: 2px solid var(--accent); }
  .tree-item.drag-over.drag-inside { outline: 2px dashed var(--accent); outline-offset: -2px; }
  .toggle { background: none; border: none; color: inherit; cursor: pointer; padding: 0; font-size: 0.7rem; }
  .label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .actions { opacity: 0; transition: opacity 0.2s; display: flex; gap: 2px; }
  .tree-item:hover .actions { opacity: 1; }
  .act { background: none; border: none; cursor: pointer; padding: 2px 4px; font-size: 0.8rem; color: inherit; }
  .children { margin-inline-start: 16px; }
</style>
