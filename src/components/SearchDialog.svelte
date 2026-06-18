<script lang="ts">
  import { hierarchy, activeNoteId } from '$lib/stores';
  import { buildIndex, searchIndex, normalizeArabic } from '$lib/search';
  import type { SearchIndex, SearchResult, SearchMatch, MatchType } from '$lib/search';
  import { onMount } from 'svelte';

  export let show = false;

  let query = '';
  let index: SearchIndex | null = null;
  let results: SearchResult[] = [];
  let indexing = false;
  let searched = false;

  const matchLabels: Record<MatchType, string> = {
    title: 'عنوان',
    heading: 'عنوان فرعي',
    content: 'محتوى',
    citation: 'اقتباس',
    figure: 'شكل',
    equation: 'معادلة',
  };

  const matchColors: Record<MatchType, string> = {
    title: '#1a73e8',
    heading: '#34a853',
    content: '#555',
    citation: '#9334e6',
    figure: '#ea8600',
    equation: '#00bcd4',
  };

  async function ensureIndex() {
    if (index) return;
    indexing = true;
    try {
      index = await buildIndex($hierarchy);
    } finally {
      indexing = false;
    }
  }

  function doSearch() {
    if (!query.trim()) {
      results = [];
      searched = false;
      return;
    }
    if (!index) return;
    results = searchIndex(index, query.trim());
    searched = true;
  }

  // Debounced search
  let debounceTimer: ReturnType<typeof setTimeout>;
  function onInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doSearch, 200);
  }

  function selectResult(noteId: string, match?: SearchMatch) {
    $activeNoteId = noteId;
    // If the match has a line index, we could scroll to it; for now just navigate
    close();
  }

  function close() {
    show = false;
    query = '';
    results = [];
    searched = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  $: if (show) {
    ensureIndex();
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });

  /** Render a snippet with <mark> around matched ranges */
  function highlightSnippet(snippet: string, ranges: [number, number][]): string {
    if (!ranges.length) return escapeHtml(snippet);
    // Sort ranges and merge overlapping
    const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      if (sorted[i][0] <= last[1]) {
        last[1] = Math.max(last[1], sorted[i][1]);
      } else {
        merged.push(sorted[i]);
      }
    }

    let html = '';
    let pos = 0;
    for (const [start, end] of merged) {
      html += escapeHtml(snippet.slice(pos, start));
      html += '<mark>' + escapeHtml(snippet.slice(start, end)) + '</mark>';
      pos = end;
    }
    html += escapeHtml(snippet.slice(pos));
    return html;
  }

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="overlay" on:click={close} role="presentation">
    <div class="dialog" on:click|stopPropagation role="dialog" tabindex="-1" dir="rtl">
      <div class="dialog-header">
        <h2>بحث</h2>
        <button class="close-btn" on:click={close}>✕</button>
      </div>

      <div class="dialog-body">
        <div class="search-input-wrap">
          <svg class="search-icon" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            class="search-input"
            type="text"
            placeholder="ابحث في الملاحظات…"
            bind:value={query}
            on:input={onInput}
            on:keydown={(e) => { if (e.key === 'Enter') doSearch(); }}
            autofocus
          />
          {#if query}
            <button class="clear-btn" on:click={() => { query = ''; results = []; searched = false; }}>✕</button>
          {/if}
        </div>

        <div class="search-hint">
          {#if indexing}
            <span class="indexing-msg">جارٍ فهرسة الملاحظات…</span>
          {:else if !index}
            <span>لم يتم بناء فهرس البحث بعد</span>
          {:else if searched && results.length === 0}
            <span class="no-results">لا توجد نتائج لـ "{query}"</span>
          {:else if searched}
            <span class="results-count">{results.length} ملاحظة / {results.reduce((s, r) => s + r.matches.length, 0)} نتيجة</span>
          {:else}
            <span>استخدم البحث للعثور على محتوى في جميع الملاحظات</span>
          {/if}
        </div>

        {#if results.length > 0}
          <div class="results-list">
            {#each results as result (result.noteId)}
              <div class="result-group">
                <button class="result-note-name" on:click={() => selectResult(result.noteId)}>
                  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                  {result.noteName}
                  <span class="match-count">{result.matches.length}</span>
                </button>
                <div class="result-matches">
                  {#each result.matches as match, i}
                    <button
                      class="result-match"
                      on:click={() => selectResult(result.noteId, match)}
                    >
                      <span class="match-badge" style="background: {matchColors[match.type]}">
                        {matchLabels[match.type]}
                      </span>
                      <span class="match-snippet">
                        {@html highlightSnippet(match.snippet, match.ranges)}
                      </span>
                    </button>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {:else if searched && query}
          <div class="empty-state">
            <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.5" width="48" height="48" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p>لم يتم العثور على نتائج</p>
            <p class="hint">جرّب كلمات مفتاحية مختلفة أو تأكد من كتابتها بشكل صحيح</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 10vh;
    z-index: 1000;
  }
  .dialog {
    background: #fff;
    color: #1a1a1a;
    border-radius: 12px;
    width: min(90vw, 600px);
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid #eee;
  }
  .dialog-header h2 {
    margin: 0;
    font-size: 1rem;
  }
  .close-btn {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: #888;
    padding: 4px 8px;
    border-radius: 4px;
  }
  .close-btn:hover { background: #f0f0f0; color: #333; }
  .dialog-body {
    padding: 0.75rem 1.25rem 1rem;
    overflow-y: auto;
    flex: 1;
  }

  .search-input-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #f5f5f5;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    padding: 0.4rem 0.75rem;
    transition: border-color 0.15s;
  }
  .search-input-wrap:focus-within {
    border-color: #1a73e8;
    background: #fff;
  }
  .search-icon {
    width: 18px;
    height: 18px;
    color: #999;
    flex-shrink: 0;
  }
  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 1rem;
    outline: none;
    font-family: inherit;
    direction: rtl;
  }
  .clear-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #999;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.9rem;
  }
  .clear-btn:hover { background: #e0e0e0; color: #333; }

  .search-hint {
    margin: 0.5rem 0;
    font-size: 0.8rem;
    color: #888;
    text-align: center;
  }
  .indexing-msg { color: #1a73e8; }
  .no-results { color: #c00; }
  .results-count { color: #1a73e8; }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .result-group {
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    overflow: hidden;
  }
  .result-note-name {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: #fafafa;
    border: none;
    border-bottom: 1px solid #e8e8e8;
    font-size: 0.85rem;
    font-weight: 700;
    color: #333;
    cursor: pointer;
    text-align: start;
    font-family: inherit;
    transition: background 0.1s;
  }
  .result-note-name:hover { background: #f0f6ff; }
  .match-count {
    margin-inline-start: auto;
    background: #e8e8e8;
    color: #666;
    font-size: 0.75rem;
    font-weight: 400;
    padding: 1px 7px;
    border-radius: 10px;
  }
  .result-matches {
    display: flex;
    flex-direction: column;
  }
  .result-match {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.4rem 0.75rem;
    border: none;
    background: transparent;
    cursor: pointer;
    text-align: start;
    font-family: inherit;
    transition: background 0.1s;
    border-bottom: 1px solid #f0f0f0;
  }
  .result-match:last-child { border-bottom: none; }
  .result-match:hover { background: #f5f9ff; }
  .match-badge {
    flex-shrink: 0;
    font-size: 0.65rem;
    color: #fff;
    padding: 1px 6px;
    border-radius: 4px;
    margin-top: 2px;
    white-space: nowrap;
  }
  .match-snippet {
    font-size: 0.8rem;
    color: #555;
    line-height: 1.5;
    direction: auto;
    unicode-bidi: plaintext;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .match-snippet :global(mark) {
    background: #ffe066;
    color: #1a1a1a;
    padding: 0 1px;
    border-radius: 2px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem;
    color: #999;
    gap: 0.5rem;
  }
  .empty-state p { margin: 0; font-size: 0.9rem; }
  .empty-state .hint { font-size: 0.8rem; color: #bbb; }
</style>
