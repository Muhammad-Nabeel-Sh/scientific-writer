<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { hierarchy } from '$lib/stores';
  import type { TreeNode } from '$lib/stores';

  const dispatch = createEventDispatcher<{ close: void; navigate: { id: string } }>();

  let query = '';
  let results: { id: string; name: string; path: string }[] = [];
  let selectedIdx = 0;
  let inputEl: HTMLInputElement;

  function collect(nodes: TreeNode[], parentPath = ''): { id: string; name: string; path: string }[] {
    const r: typeof results = [];
    for (const n of nodes) {
      const label = n.name.replace(/\.md$/i, '');
      const path = parentPath ? `${parentPath} / ${label}` : label;
      if (n.type === 'note') r.push({ id: n.id, name: label, path });
      if (n.children) r.push(...collect(n.children, path));
    }
    return r;
  }

  $: allNotes = collect($hierarchy);
  $: filtered = query.trim()
    ? allNotes.filter(n =>
        n.name.toLowerCase().includes(query.toLowerCase()) ||
        n.path.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 20)
    : allNotes.slice(0, 20);

  function navigate(id: string) {
    dispatch('navigate', { id });
    dispatch('close');
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { dispatch('close'); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); selectedIdx = Math.min(selectedIdx + 1, filtered.length - 1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); selectedIdx = Math.max(selectedIdx - 1, 0); return; }
    if (e.key === 'Enter') { e.preventDefault(); if (filtered[selectedIdx]) navigate(filtered[selectedIdx].id); return; }
    selectedIdx = 0;
  }

  onMount(() => {
    setTimeout(() => inputEl?.focus(), 50);
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="overlay" on:click={() => dispatch('close')} on:keydown role="presentation">
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div class="dialog" on:click|stopPropagation on:keydown role="dialog" tabindex="-1" dir="rtl">
    <div class="search-row">
      <svg class="search-icon" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        bind:this={inputEl}
        class="search-input"
        type="text"
        placeholder="ابحث عن ملاحظة…"
        bind:value={query}
        on:keydown={onKeydown}
      />
    </div>
    <div class="results-list">
      {#each filtered as item, i}
        <button
          class="result-item"
          class:selected={i === selectedIdx}
          on:click={() => navigate(item.id)}
          on:mouseenter={() => (selectedIdx = i)}
        >
          <span class="item-name">{item.name}</span>
          {#if item.path !== item.name}
            <span class="item-path">{item.path}</span>
          {/if}
        </button>
      {:else}
        <div class="empty-msg">لا توجد نتائج</div>
      {/each}
    </div>
    <div class="footer">
      <span class="key-hint"><kbd>↑</kbd><kbd>↓</kbd> تنقل</span>
      <span class="key-hint"><kbd>↵</kbd> فتح</span>
      <span class="key-hint"><kbd>Esc</kbd> إغلاق</span>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex; align-items: flex-start; justify-content: center;
    padding-top: 15vh;
    z-index: 1000;
  }
  .dialog {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    width: min(90vw, 480px);
    max-height: 60vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  }
  .search-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
  }
  .search-icon { width: 18px; height: 18px; color: var(--fg-muted); flex-shrink: 0; }
  .search-input {
    flex: 1;
    border: none; background: transparent;
    color: var(--fg); font-size: 1rem;
    font-family: inherit; direction: rtl;
    outline: none;
  }
  .search-input::placeholder { color: var(--fg-muted); }
  .results-list {
    overflow-y: auto;
    flex: 1;
    padding: 0.25rem 0.5rem;
  }
  .result-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: 8px 12px;
    background: none; border: none;
    color: var(--fg);
    cursor: pointer;
    border-radius: 6px;
    font-family: inherit;
    text-align: start;
    transition: background 0.1s;
  }
  .result-item:hover,
  .result-item.selected { background: var(--bg-hover); }
  .item-name { font-size: 0.9rem; }
  .item-path { font-size: 0.75rem; color: var(--fg-muted); }
  .empty-msg { color: var(--fg-muted); padding: 1.5rem; text-align: center; font-size: 0.85rem; }
  .footer {
    display: flex; gap: 12px; justify-content: center;
    padding: 0.5rem 1rem;
    border-top: 1px solid var(--border);
    font-size: 0.7rem;
    color: var(--fg-muted);
  }
  .key-hint { display: flex; align-items: center; gap: 4px; }
  .key-hint kbd {
    background: #2a2a2a; border: 1px solid var(--border);
    border-radius: 3px; padding: 1px 5px;
    font-family: var(--font-mono); font-size: 0.7rem;
  }
</style>
