<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { bibEntries } from '$lib/stores';
  import type { BibEntry } from '$lib/bibliography';
  import { isArabicEntry } from '$lib/bibliography';
  import Fuse from 'fuse.js';

  export let insertAtCursor: (text: string) => void;

  const dispatch = createEventDispatcher<{ close: void }>();

  let entries: BibEntry[] = [];
  let query = '';
  let results: BibEntry[] = [];
  let selectedIndex = 0;
  let inputEl: HTMLInputElement;
  let fuse: Fuse<BibEntry> | null = null;

  $: entries = $bibEntries;

  function initFuse() {
    if (entries.length === 0) return;
    fuse = new Fuse(entries, {
      keys: [
        { name: 'fields.author', weight: 2, getFn: (item) => item.fields.author || '' },
        { name: 'fields.title', weight: 1.5, getFn: (item) => item.fields.title || '' },
        { name: 'fields.year', weight: 1, getFn: (item) => item.fields.year || '' },
      ],
      threshold: 0.4,
      distance: 200,
      minMatchCharLength: 1,
      shouldSort: true,
      findAllMatches: true,
    });
    results = entries;
  }

  onMount(() => {
    initFuse();
    inputEl?.focus();
  });

  function handleInput() {
    if (!fuse || !query.trim()) {
      results = entries;
      selectedIndex = 0;
      return;
    }
    results = fuse.search(query).map(r => r.item);
    if (selectedIndex >= results.length) selectedIndex = Math.max(0, results.length - 1);
  }

  function selectEntry(entry: BibEntry) {
    insertAtCursor(`[@${entry.key}]`);
    setTimeout(() => dispatch('close'), 0);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { dispatch('close'); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (selectedIndex < results.length - 1) selectedIndex++; return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (selectedIndex > 0) selectedIndex--; return; }
    if (e.key === 'Enter') { e.preventDefault(); if (results[selectedIndex]) selectEntry(results[selectedIndex]); return; }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" on:click={() => dispatch('close')} on:keydown role="presentation">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog" on:click|stopPropagation on:keydown role="dialog" tabindex="-1">
    <div class="header">
      <h3>استشهاد</h3>
      <button class="close-btn" on:click={() => dispatch('close')}>✕</button>
    </div>

    <input
      bind:this={inputEl}
      bind:value={query}
      on:input={handleInput}
      on:keydown={onKeydown}
      class="search-input"
      placeholder="ابحث عن مرجع..."
      dir="rtl"
      autofocus
    /><!-- svelte-ignore a11y_autofocus -->

    <div class="results">
      {#if entries.length === 0}
        <div class="empty">لا توجد مراجع بعد. افتح ملف references.bib وأضف مراجعك</div>
      {:else if results.length === 0 && query.trim()}
        <div class="empty">لا توجد نتائج</div>
      {:else}
        {#each results as entry, i}
          <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
          <div
            class="result-item"
            class:selected={i === selectedIndex}
            on:click={() => selectEntry(entry)}
            on:mouseenter={() => (selectedIndex = i)}
          >
            <div class="result-row">
              <span class="author" dir="auto">{entry.fields.author?.replace(/[{}]/g, '') || '?'}</span>
              {#if entry.fields.year}
                <span class="year">{entry.fields.year.replace(/[{}]/g, '')}</span>
              {/if}
            </div>
            <div class="result-title" dir="auto">{entry.fields.title?.replace(/[{}]/g, '') || ''}</div>
            <div class="result-meta">
              <span class="key-badge">{entry.key}</span>
              <span class="entry-type">{entry.type}</span>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <div class="footer">
      <span class="attribution">{entries.length} مرجع</span>
      <span class="hint">↑↓ للتنقل ↵ للإدراج</span>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.5);
    display: flex; align-items: center; justify-content: center; z-index: 200;
  }
  .dialog {
    background: var(--bg-panel); border: 1px solid var(--border);
    border-radius: 10px; width: 600px; max-height: 80vh;
    display: flex; flex-direction: column; box-shadow: 0 8px 24px rgba(0,0,0,.5);
  }
  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 1rem 0; flex-shrink: 0;
  }
  .header h3 { margin: 0; font-size: 1.1rem; }
  .close-btn { background: none; border: none; color: var(--fg-muted); cursor: pointer; font-size: 1.2rem; padding: 4px; border-radius: 4px; }
  .close-btn:hover { color: var(--fg); background: var(--bg-hover); }
  .search-input {
    margin: 0.75rem 1rem; padding: 0.6rem 0.8rem; border-radius: 6px;
    border: 1px solid var(--border); background: #2a2a2a; color: var(--fg);
    font-family: var(--font-serif); font-size: 1rem; direction: rtl;
  }
  .search-input:focus { outline: none; border-color: var(--accent); }
  .results { overflow-y: auto; padding: 0 1rem 1rem; flex: 1; }
  .result-item {
    padding: 10px 12px; border-radius: 6px; cursor: pointer;
    transition: background 0.1s; margin-bottom: 3px;
  }
  .result-item:hover { background: var(--bg-hover); }
  .result-item.selected { background: var(--bg-hover); outline: 1px solid var(--accent); }
  .result-row { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; flex-wrap: wrap; }
  .author { font-size: 0.95rem; font-weight: 600; color: var(--fg); }
  .year { font-size: 0.85rem; color: var(--accent); font-family: var(--font-mono); direction: ltr; unicode-bidi: isolate; }
  .result-title { font-size: 0.85rem; color: var(--fg-muted); margin-bottom: 4px; line-height: 1.4; }
  .result-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .key-badge {
    background: #333; color: var(--fg); padding: 1px 6px;
    border-radius: 3px; font-size: 0.75rem; font-family: var(--font-mono);
  }
  .entry-type { font-size: 0.7rem; color: var(--fg-muted); text-transform: lowercase; }
  .empty { color: var(--fg-muted); text-align: center; padding: 2rem; font-size: 0.9rem; }
  .footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.5rem 1rem; border-top: 1px solid var(--border);
    font-size: 0.75rem; color: var(--fg-muted); flex-shrink: 0;
  }
  .hint { color: var(--fg-muted); font-size: 0.7rem; }
</style>
