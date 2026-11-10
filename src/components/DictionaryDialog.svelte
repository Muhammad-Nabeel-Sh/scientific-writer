<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";

  export let appendText: (text: string) => void;

  const dispatch = createEventDispatcher<{ close: void }>();

  let query = "";
  let results: {
    word: string;
    meanings: string;
    dict_name: string;
    dict_ar: string;
  }[] = [];
  let dicts: { table: string; ar: string; en: string; group: string }[] = [];
  let selectedDict = "";
  let selectedGroup = "all";
  let searchMode: "word" | "root" = "word";
  let useDefinitionEnv = false;
  let loading = false;
  let error = "";
  let inputEl: HTMLInputElement;

  onMount(() => {
    inputEl?.focus();
  });

  $: if (dicts.length === 0) {
    invoke<typeof dicts>("list_dictionaries")
      .then((d) => {
        dicts = d;
      })
      .catch((e) => {
        error = "فشل تحميل قائمة القواميس: " + String(e);
      });
  }

  async function doSearch() {
    const q = query.trim();
    if (!q) {
      results = [];
      return;
    }
    loading = true;
    error = "";
    try {
      results = await invoke<typeof results>("search_dictionary", {
        query: q,
        dictTable: selectedDict || null,
        searchMode: searchMode,
        dictGroup: selectedDict ? null : selectedGroup,
      });
    } catch (e) {
      results = [];
      error = String(e);
    }
    loading = false;
  }

  function insert(
    entry: (typeof results)[number],
    part: "word" | "meaning" | "both",
  ) {
    let text: string;
    if (part === "word") text = entry.word;
    else if (part === "meaning") text = entry.meanings;
    else text = `${entry.word}: ${entry.meanings}`;
    if (useDefinitionEnv) {
      text = `:::تعريف\n${text}\n:::\n\n`;
    } else {
      text += "\n\n";
    }
    appendText(text);
    dispatch("close");
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") dispatch("close");
    if (e.key === "Enter") doSearch();
  }

  $: filteredDicts =
    selectedGroup === "all"
      ? dicts
      : dicts.filter((d) => d.group === selectedGroup);
</script>

<div
  class="overlay"
  on:click={() => dispatch("close")}
  on:keydown
  role="presentation"
>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="dialog"
    on:click|stopPropagation
    on:keydown
    role="dialog"
    tabindex="-1"
  >
    <div class="header">
      <h3>القاموس</h3>
      <button class="close-btn" on:click={() => dispatch("close")}>✕</button>
    </div>

    <div class="search-row">
      <input
        bind:this={inputEl}
        bind:value={query}
        on:keydown={onKeydown}
        class="search-input"
        placeholder="ابحث عن كلمة..."
        dir="rtl"
      />
      <button
        class="mode-btn"
        class:active={searchMode === "word"}
        on:click={() => {
          searchMode = "word";
          doSearch();
        }}
        title="بحث بالكلمة">كلمة</button
      >
      <button
        class="mode-btn"
        class:active={searchMode === "root"}
        on:click={() => {
          searchMode = "root";
          doSearch();
        }}
        title="بحث بالجذر">جذر</button
      >
    </div>

    <div class="filter-row">
      <select bind:value={selectedDict} class="dict-select">
        <option value="">-- الكل --</option>
        {#each filteredDicts as d}
          <option value={d.table}>{d.ar}</option>
        {/each}
      </select>
      <select
        bind:value={selectedGroup}
        class="group-select"
        disabled={!!selectedDict}
      >
        <option value="all">جميع القواميس</option>
        <option value="ar">عربية</option>
        <option value="ar_en">عربية-إنجليزية</option>
      </select>
      <button class="search-btn" on:click={doSearch}>بحث</button>
    </div>

    <label class="env-toggle">
      <input type="checkbox" bind:checked={useDefinitionEnv} />
      <span>ضمن بيئة تعريف</span>
    </label>

    <div class="results">
      {#if error}
        <div class="error-msg dir-rtl">{error}</div>
      {/if}
      {#if loading}
        <div class="empty">جارٍ البحث…</div>
      {:else if results.length === 0 && query.trim() && !error}
        <div class="empty">لا توجد نتائج</div>
      {:else}
        {#each results as entry, i (entry.dict_name + "-" + entry.word + "-" + i)}
          <div class="result-item">
            <div class="result-header">
              <span class="word">{entry.word}</span>
              <span class="dict-badge">{entry.dict_ar}</span>
            </div>
            <div class="meanings">{entry.meanings}</div>
            <div class="insert-row">
              <button
                class="ins-btn"
                on:click|stopPropagation={() => insert(entry, "word")}
                >الكلمة</button
              >
              <button
                class="ins-btn"
                on:click|stopPropagation={() => insert(entry, "meaning")}
                >المعنى</button
              >
              <button
                class="ins-btn ins-primary"
                on:click|stopPropagation={() => insert(entry, "both")}
                >كلاهما</button
              >
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <div class="footer">
      <span class="attribution">
        بيانات ١١ قاموساً من <a href="https://github.com/wizsk/arabic_lexicons"
          >arabic_lexicons</a
        >
      </span>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }
  .dialog {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    width: 640px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1rem 0;
    flex-shrink: 0;
  }
  .header h3 {
    margin: 0;
    font-size: 1.1rem;
  }
  .close-btn {
    background: none;
    border: none;
    color: var(--fg-muted);
    cursor: pointer;
    font-size: 1.2rem;
    padding: 4px;
  }
  .close-btn:hover {
    color: var(--fg);
  }
  .search-row {
    display: flex;
    gap: 6px;
    padding: 0.75rem 1rem 0.4rem;
    flex-shrink: 0;
  }
  .search-input {
    flex: 1;
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: #2a2a2a;
    color: var(--fg);
    font-family: var(--font-serif);
    font-size: 1rem;
    direction: rtl;
  }
  .search-input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .mode-btn {
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: #2a2a2a;
    color: var(--fg-muted);
    cursor: pointer;
    font-size: 0.8rem;
    white-space: nowrap;
    transition: 0.1s;
  }
  .mode-btn.active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }
  .mode-btn:hover:not(.active) {
    background: #3a3a3a;
  }
  .filter-row {
    display: flex;
    gap: 8px;
    padding: 0.4rem 1rem 0.75rem;
    flex-shrink: 0;
  }
  .dict-select {
    flex: 1;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: #2a2a2a;
    color: var(--fg);
    font-size: 0.85rem;
  }
  .dict-select:focus {
    outline: none;
    border-color: var(--accent);
  }
  .group-select {
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: #2a2a2a;
    color: var(--fg);
    font-size: 0.85rem;
    min-width: 130px;
  }
  .group-select:focus {
    outline: none;
    border-color: var(--accent);
  }
  .group-select:disabled {
    opacity: 0.4;
  }
  .search-btn {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1.2rem;
    cursor: pointer;
    font-size: 0.85rem;
    white-space: nowrap;
  }
  .search-btn:hover {
    opacity: 0.9;
  }
  .env-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 1rem 0.5rem;
    font-size: 0.8rem;
    color: var(--fg-muted);
    cursor: pointer;
    user-select: none;
    flex-shrink: 0;
  }
  .env-toggle input {
    accent-color: var(--accent);
  }
  .results {
    overflow-y: auto;
    padding: 0 1rem 1rem;
    flex: 1;
  }
  .result-item {
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 6px;
    border: 1px solid transparent;
    transition: border-color 0.15s;
  }
  .result-item:hover {
    border-color: var(--border);
    background: #1a1a1a;
  }
  .result-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .word {
    font-family: var(--font-serif);
    font-size: 1.1rem;
    font-weight: 600;
    direction: rtl;
  }
  .dict-badge {
    font-size: 0.7rem;
    background: #333;
    color: var(--fg-muted);
    padding: 2px 8px;
    border-radius: 4px;
    white-space: nowrap;
  }
  .meanings {
    font-family: var(--font-serif);
    font-size: 0.9rem;
    line-height: 1.6;
    direction: rtl;
    color: var(--fg-muted);
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-clamp: 4;
  }
  .result-item:hover .meanings {
    -webkit-line-clamp: unset;
    line-clamp: unset;
  }
  .insert-row {
    display: flex;
    gap: 6px;
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px solid #2a2a2a;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .result-item:hover .insert-row {
    opacity: 1;
  }
  .ins-btn {
    padding: 3px 10px;
    border-radius: 4px;
    border: 1px solid #444;
    background: transparent;
    color: var(--fg-muted);
    cursor: pointer;
    font-size: 0.75rem;
    transition: 0.1s;
  }
  .ins-btn:hover {
    background: #333;
    color: var(--fg);
  }
  .ins-primary {
    border-color: var(--accent);
    color: var(--accent);
  }
  .ins-primary:hover {
    background: var(--accent);
    color: #fff;
  }
  .empty {
    color: var(--fg-muted);
    text-align: center;
    padding: 2rem;
  }
  .error-msg {
    background: #3a1a1a;
    color: #ff8080;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 0.5rem;
    font-size: 0.8rem;
    direction: ltr;
    text-align: left;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .dir-rtl {
    direction: rtl;
    text-align: right;
  }
  .footer {
    padding: 0.5rem 1rem;
    border-top: 1px solid var(--border);
    font-size: 0.75rem;
    color: var(--fg-muted);
    text-align: center;
    flex-shrink: 0;
  }
  .footer a {
    color: var(--accent);
  }
</style>
