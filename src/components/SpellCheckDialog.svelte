<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';

  export let text: string;

  const dispatch = createEventDispatcher<{ close: void; replace: { word: string; replacement: string } }>();

  let loading = true;
  let errors: { word: string; suggestions: string[] }[] = [];
  let totalChecked = 0;
  let replacing = '';

  onMount(async () => {
    try {
      const result = await invoke<{ word: string; suggestions: string[] }[]>('check_spelling', { text });
      errors = result;
    } catch (e) {
      errors = [];
      console.error('Spellcheck error:', e);
    } finally {
      loading = false;
    }
  });

  function handleReplace(word: string, replacement: string) {
    replacing = word;
    dispatch('replace', { word, replacement });
    setTimeout(() => { replacing = ''; }, 600);
  }
</script>

<div class="sp-overlay" on:click={() => dispatch('close')} role="presentation">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="sp-dialog" on:click|stopPropagation on:keydown={(e) => { if (e.key === 'Escape') dispatch('close'); }} role="dialog" tabindex="-1">
    <div class="sp-header">
      <h3>التدقيق الإملائي</h3>
      <button class="close-btn" on:click={() => dispatch('close')}>✕</button>
    </div>

    <div class="sp-body">
      {#if loading}
        <div class="sp-loading">جاري التدقيق...</div>
      {:else if errors.length === 0}
        <div class="sp-empty">✓ لا توجد أخطاء إملائية</div>
      {:else}
        <div class="sp-summary">تم العثور على {errors.length} خطأ</div>
        <div class="sp-list">
          {#each errors as err, i}
            <div class="sp-item">
              <div class="sp-word-row">
                <span class="sp-word">{err.word}</span>
              </div>
              <div class="sp-suggestions">
                {#if err.suggestions.length === 0}
                  <span class="sp-no-suggest">— لا توجد اقتراحات</span>
                {:else}
                  {#each err.suggestions as sug}
                    <button
                      class="sp-sug-btn"
                      on:click={() => handleReplace(err.word, sug)}
                      disabled={replacing === err.word}
                    >
                      {sug}
                    </button>
                  {/each}
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .sp-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }
  .sp-dialog {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    width: min(90vw, 550px);
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }
  .sp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem 0;
    flex-shrink: 0;
  }
  .sp-header h3 {
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
    border-radius: 4px;
  }
  .close-btn:hover {
    color: var(--fg);
    background: var(--bg-hover);
  }
  .sp-body {
    padding: 1rem 1.25rem;
    overflow-y: auto;
    flex: 1;
  }
  .sp-loading, .sp-empty {
    text-align: center;
    padding: 2rem 0;
    color: var(--fg-muted);
  }
  .sp-empty {
    font-size: 1.2rem;
    color: #4caf50;
  }
  .sp-summary {
    font-size: 0.85rem;
    color: var(--fg-muted);
    margin-bottom: 0.75rem;
  }
  .sp-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .sp-item {
    background: #1e1e1e;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
  }
  .sp-word {
    font-weight: 600;
    font-size: 1.05rem;
    color: #f44336;
    font-family: var(--font-mono);
  }
  .sp-suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 6px;
  }
  .sp-sug-btn {
    background: #2a2a2a;
    border: 1px solid var(--border);
    color: var(--fg);
    padding: 3px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    font-family: inherit;
    transition: background 0.15s;
  }
  .sp-sug-btn:hover:not(:disabled) {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }
  .sp-sug-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .sp-no-suggest {
    color: var(--fg-muted);
    font-size: 0.85rem;
  }
</style>
