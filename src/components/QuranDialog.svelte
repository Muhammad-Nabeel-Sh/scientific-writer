<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { searchQuran, getVersesInRange, getMaxAyah, formatVerse, formatVerseRange, type Verse } from '$lib/quran';

  export let appendText: (text: string) => void;

  const dispatch = createEventDispatcher<{ close: void }>();

  let query = '';
  let results: Verse[] = [];
  let inputEl: HTMLInputElement;

  onMount(() => {
    inputEl?.focus();
  });

  let expandedSurah = 0;
  let rangeFrom = 1;
  let rangeTo = 1;
  let maxVerse = 1;

  function handleInput() {
    results = searchQuran(query);
    expandedSurah = 0;
  }

  function insertVerse(v: Verse) {
    appendText(formatVerse(v) + '\n\n');
    dispatch('close');
  }

  function expandRange(v: Verse) {
    if (expandedSurah === v.surah) {
      expandedSurah = 0;
      return;
    }
    expandedSurah = v.surah;
    rangeFrom = v.ayah;
    rangeTo = Math.min(v.ayah + 1, getMaxAyah(v.surah));
    maxVerse = getMaxAyah(v.surah);
  }

  function insertRange(surah: number) {
    const start = Math.min(rangeFrom, rangeTo);
    const end = Math.max(rangeFrom, rangeTo);
    const vv = getVersesInRange(surah, start, end);
    appendText(formatVerseRange(vv) + '\n\n');
    dispatch('close');
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      dispatch('close');
    }
  }
</script>

<div class="overlay" on:click={() => dispatch('close')} on:keydown role="presentation">
  <div class="dialog" on:click|stopPropagation on:keydown role="dialog" tabindex="-1">
    <div class="header">
      <h3>بحث في القرآن</h3>
      <button class="close-btn" on:click={() => dispatch('close')}>✕</button>
    </div>

    <input
      bind:this={inputEl}
      bind:value={query}
      on:input={handleInput}
      on:keydown={onKeydown}
      class="search-input"
      placeholder="ابحث بكلمة أو آية..."
      dir="rtl"
    />

    <div class="results">
      {#if results.length === 0 && query.trim()}
        <div class="empty">لا توجد نتائج</div>
      {/if}
      {#each results as v, i (v.surah + '-' + v.ayah)}
        <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
        <div class="result-item" class:expanded={expandedSurah === v.surah}>
          <div class="result-row">
            <span class="ref">[ {v.sname}: {v.ayah} ]</span>
            <span class="verse-text">{v.text}</span>
            <div class="row-actions">
              <button class="action-btn" title="إدراج آية" on:click|stopPropagation={() => insertVerse(v)}>إدراج</button>
              <button class="action-btn" title="تحديد مدى" on:click|stopPropagation={() => expandRange(v)}>
                <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" width="14" height="14">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
          {#if expandedSurah === v.surah}
            <div class="range-picker" on:click|stopPropagation>
              <label for="range-from">من الآية:</label>
              <input id="range-from" type="number" bind:value={rangeFrom} min="1" max={maxVerse} class="range-input" />
              <label for="range-to">إلى الآية:</label>
              <input id="range-to" type="number" bind:value={rangeTo} min="1" max={maxVerse} class="range-input" />
              <button class="insert-range-btn" on:click={() => insertRange(v.surah)}>
                إدراج ({rangeFrom}–{rangeTo})
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <div class="footer">
      <span class="attribution">البيانات من <a href="https://tanzil.net">Tanzil.net</a></span>
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
    border-radius: 10px; width: 560px; max-height: 80vh;
    display: flex; flex-direction: column; box-shadow: 0 8px 24px rgba(0,0,0,.5);
  }
  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 1rem 0; flex-shrink: 0;
  }
  .header h3 { margin: 0; font-size: 1.1rem; }
  .close-btn { background: none; border: none; color: var(--fg-muted); cursor: pointer; font-size: 1.2rem; padding: 4px; }
  .close-btn:hover { color: var(--fg); }
  .search-input {
    margin: 0.75rem 1rem; padding: 0.6rem 0.8rem; border-radius: 6px;
    border: 1px solid var(--border); background: #2a2a2a; color: var(--fg);
    font-family: var(--font-serif); font-size: 1rem; direction: rtl;
  }
  .search-input:focus { outline: none; border-color: var(--accent); }
  .results { overflow-y: auto; padding: 0 1rem 1rem; flex: 1; }
  .result-item {
    border-radius: 6px; margin-bottom: 2px;
  }
  .result-item.expanded {
    background: #1e1e1e;
  }
  .result-row {
    display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; cursor: pointer;
    border-radius: 6px; transition: background 0.1s;
  }
  .result-row:hover { background: var(--bg-hover); }
  .ref { font-size: 0.8rem; color: var(--accent); font-family: var(--font-mono); white-space: nowrap; padding-top: 2px; }
  .verse-text { font-family: var(--font-serif); font-size: 1.05rem; line-height: 1.6; direction: rtl; flex: 1; }
  .row-actions { display: flex; gap: 4px; flex-shrink: 0; }
  .action-btn {
    background: #333; border: 1px solid #555; color: var(--fg); cursor: pointer;
    border-radius: 4px; padding: 2px 8px; font-size: 0.75rem; white-space: nowrap;
    display: flex; align-items: center; height: 24px;
  }
  .action-btn:hover { background: #444; }
  .range-picker {
    display: flex; align-items: center; gap: 6px; padding: 6px 10px 10px 10px;
    flex-wrap: wrap;
  }
  .range-picker label { font-size: 0.8rem; color: var(--fg-muted); }
  .range-input {
    width: 60px; padding: 3px 6px; border-radius: 4px; border: 1px solid var(--border);
    background: #2a2a2a; color: var(--fg); font-size: 0.85rem; text-align: center;
  }
  .range-input:focus { outline: none; border-color: var(--accent); }
  .insert-range-btn {
    background: var(--accent); color: #fff; border: none; border-radius: 4px;
    padding: 4px 12px; cursor: pointer; font-size: 0.8rem;
  }
  .insert-range-btn:hover { opacity: 0.9; }
  .empty { color: var(--fg-muted); text-align: center; padding: 2rem; }
  .footer {
    padding: 0.5rem 1rem; border-top: 1px solid var(--border);
    font-size: 0.75rem; color: var(--fg-muted); text-align: center; flex-shrink: 0;
  }
  .footer a { color: var(--accent); }
</style>
