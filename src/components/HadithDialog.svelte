<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import { loadAllHadiths, searchHadiths, formatHadithInsert, type HadithSearchResult } from '$lib/hadith';

  export let appendText: (text: string) => void;

  const dispatch = createEventDispatcher<{ close: void }>();

  let query = '';
  let results: HadithSearchResult[] = [];
  let loading = true;
  let loadStatus = 'جاري تحميل بيانات الأحاديث...';
  let totalLoaded = 0;
  let inputEl: HTMLInputElement;

  onMount(async () => {
    await loadAllHadiths((key, done) => {
      totalLoaded = done;
      loadStatus = `تم تحميل ${done} حديث...`;
    });
    loading = false;
    loadStatus = `تم تحميل ${totalLoaded} حديث`;
    await tick();
    inputEl?.focus();
  });

  function handleInput() {
    results = searchHadiths(query);
  }

  function insertHadith(r: HadithSearchResult) {
    appendText(formatHadithInsert(r) + '\n\n');
    dispatch('close');
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') dispatch('close');
  }
</script>

<div class="overlay" on:click={() => dispatch('close')} on:keydown role="presentation">
  <div class="dialog" on:click|stopPropagation on:keydown role="dialog" tabindex="-1">
    <div class="header">
      <h3>بحث في الأحاديث</h3>
      <button class="close-btn" on:click={() => dispatch('close')}>✕</button>
    </div>

    <input
      bind:this={inputEl}
      bind:value={query}
      on:input={handleInput}
      on:keydown={onKeydown}
      class="search-input"
      placeholder={loading ? loadStatus : 'ابحث في الأحاديث...'}
      dir="rtl"
      disabled={loading}
    />

    {#if loading}
      <div class="loading-bar">
        <div class="bar"></div>
        <span class="load-text">{loadStatus}</span>
      </div>
    {/if}

    <div class="results">
      {#if !loading && results.length === 0 && query.trim()}
        <div class="empty">لا توجد نتائج</div>
      {/if}
      {#each results as r, i}
        <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
        <div class="result-item" class:selected={false} on:click={() => insertHadith(r)}>
          <div class="result-meta">
            <span class="book-badge">{r.bookTitle}</span>
            <span class="ref">رقم {r.idInBook}</span>
            {#if r.chapter}
              <span class="chapter">{r.chapter}</span>
            {/if}
          </div>
          <div class="result-text">{r.arabic}</div>
        </div>
      {/each}
    </div>

    <div class="footer">
      <span class="attribution">{totalLoaded} حديث من 9 كتب</span>
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
    border-radius: 10px; width: 620px; max-height: 85vh;
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
  .search-input:disabled { opacity: 0.6; }
  .loading-bar {
    padding: 0 1rem 0.5rem;
    display: flex; flex-direction: column; gap: 4px;
  }
  .bar {
    height: 3px; background: #333; border-radius: 2px; overflow: hidden;
  }
  .bar::after {
    content: ''; display: block; height: 100%; width: 30%;
    background: var(--accent); border-radius: 2px;
    animation: load 1.5s ease-in-out infinite;
  }
  @keyframes load { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
  .load-text { font-size: 0.8rem; color: var(--fg-muted); }
  .results { overflow-y: auto; padding: 0 1rem 1rem; flex: 1; }
  .result-item {
    padding: 10px 12px; border-radius: 6px; cursor: pointer;
    transition: background 0.1s; margin-bottom: 3px;
  }
  .result-item:hover { background: var(--bg-hover); }
  .result-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
  .book-badge {
    background: var(--accent); color: #fff; padding: 1px 8px;
    border-radius: 4px; font-size: 0.75rem; font-family: var(--font-sans);
  }
  .ref { font-size: 0.75rem; color: var(--accent); font-family: var(--font-mono); }
  .chapter { font-size: 0.75rem; color: var(--fg-muted); font-family: var(--font-sans); }
  .result-text {
    font-family: var(--font-serif); font-size: 0.95rem; line-height: 1.6; direction: rtl;
    max-height: 4.8em; overflow: hidden; text-overflow: ellipsis;
  }
  .empty { color: var(--fg-muted); text-align: center; padding: 2rem; }
  .footer {
    padding: 0.5rem 1rem; border-top: 1px solid var(--border);
    font-size: 0.75rem; color: var(--fg-muted); text-align: center; flex-shrink: 0;
  }
</style>
