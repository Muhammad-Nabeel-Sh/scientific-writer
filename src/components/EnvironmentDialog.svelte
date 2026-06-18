<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { getBlockConfigs, registerCustomBlock, injectBlockStyle } from '$lib/blocks';
  import type { BlockTypeConfig } from '$lib/blocks';

  export let insertBlock: (type: string) => void;

  const dispatch = createEventDispatcher<{ close: void }>();

  let blocks: BlockTypeConfig[] = getBlockConfigs();
  let customType = '';
  let customColor = '#1a73e8';
  let customNumbered = true;

  const defaultColors: Record<string, string> = {
    theorem: '#1a73e8',
    definition: '#34a853',
    lemma: '#9334e6',
    corollary: '#ea8600',
    example: '#00bcd4',
    warning: '#ea4335',
    note: '#757575',
    exercise: '#e67e22',
  };
  let colors: Record<string, string> = {};

  $: {
    for (const block of blocks) {
      if (!(block.type in colors)) {
        colors[block.type] = defaultColors[block.type] || '#1a73e8';
      }
    }
  }

  function updateColor(type: string, color: string) {
    colors[type] = color;
    injectBlockStyle(type, color);
  }

  function insert(type: string) {
    insertBlock(type);
    dispatch('close');
  }

  function insertCustom() {
    const name = customType.trim();
    if (!name) return;
    registerCustomBlock({
      type: name,
      labels: { en: name, ar: name },
      numbered: customNumbered,
    });
    injectBlockStyle(name, customColor);
    insertBlock(name);
    dispatch('close');
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { dispatch('close'); return; }
    if (e.key === 'Enter' && customType.trim()) { e.preventDefault(); insertCustom(); return; }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="env-overlay" on:click={() => dispatch('close')} on:keydown role="presentation">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="env-dialog" on:click|stopPropagation on:keydown={onKeydown} role="dialog" tabindex="-1">
    <div class="env-header">
      <h3>بيئة أكاديمية</h3>
      <button class="close-btn" on:click={() => dispatch('close')}>✕</button>
    </div>

    <div class="env-columns">
      <!-- English Environments -->
      <div class="env-col">
        <h4 class="col-title">English Environments</h4>
        <div class="col-body">
          {#each blocks as block}
            <div class="env-row">
              <div class="env-info">
                <input
                  type="color"
                  value={colors[block.type] || defaultColors[block.type] || '#1a73e8'}
                  on:input={(e) => updateColor(block.type, (e.target as HTMLInputElement).value)}
                  class="color-swatch"
                  title="تغيير اللون"
                />
                <span class="env-label">{block.labels.en}</span>
                {#if block.numbered}
                  <span class="env-badge">#</span>
                {/if}
              </div>
              <button class="btn-insert" on:click={() => insert(block.type)}>إدراج</button>
            </div>
          {/each}
        </div>
      </div>

      <!-- Arabic Environments -->
      <div class="env-col">
        <h4 class="col-title">Arabic Environments</h4>
        <div class="col-body">
          {#each blocks as block}
            <div class="env-row">
              <div class="env-info">
                <input
                  type="color"
                  value={colors[block.type] || defaultColors[block.type] || '#1a73e8'}
                  on:input={(e) => updateColor(block.type, (e.target as HTMLInputElement).value)}
                  class="color-swatch"
                  title="تغيير اللون"
                />
                <span class="env-label ar">{block.labels.ar}</span>
                {#if block.numbered}
                  <span class="env-badge">#</span>
                {/if}
              </div>
              <button class="btn-insert" on:click={() => insert(block.labels.ar)}>إدراج</button>
            </div>
          {/each}
        </div>
      </div>

      <!-- Custom Environment -->
      <div class="env-col env-col-custom">
        <h4 class="col-title">Custom Environment</h4>
        <div class="col-body">
          <div class="custom-section">
            <label class="custom-label" for="env-custom-type">Type name</label>
            <input
              id="env-custom-type"
              type="text"
              bind:value={customType}
              class="custom-input"
              placeholder="clinical-case"
              dir="ltr"
            />
          </div>
          <div class="custom-section">
            <label class="custom-label" for="env-custom-color">Color</label>
            <div class="color-row">
              <input id="env-custom-color" type="color" bind:value={customColor} class="color-picker" />
              <span class="color-value">{customColor}</span>
            </div>
          </div>
          <div class="custom-section">
            <label class="custom-checkbox">
              <input type="checkbox" bind:checked={customNumbered} />
              <span>مرقم</span>
            </label>
          </div>
          <button
            class="btn-insert btn-custom-insert"
            disabled={!customType.trim()}
            on:click={insertCustom}
          >إدراج بيئة مخصصة</button>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .env-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }
  .env-dialog {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    width: 880px;
    max-width: 95vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }
  .env-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1rem 0.5rem;
    flex-shrink: 0;
  }
  .env-header h3 {
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
  .env-columns {
    display: flex;
    gap: 0;
    padding: 0.5rem 1rem 1rem;
    overflow: hidden;
    flex: 1;
  }
  .env-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .env-col + .env-col {
    border-inline-start: 1px solid var(--border);
    padding-inline-start: 1rem;
  }
  .env-col:first-child {
    padding-inline-end: 1rem;
  }
  .col-title {
    font-size: 0.8rem;
    color: var(--fg-muted);
    margin: 0 0 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }
  .col-body {
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .env-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background: #1a1a1a;
    border-radius: 6px;
    border: 1px solid var(--border);
  }
  .env-info {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .color-swatch {
    width: 20px;
    height: 20px;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0;
    cursor: pointer;
    flex-shrink: 0;
  }
  .color-swatch::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  .color-swatch::-webkit-color-swatch {
    border: none;
    border-radius: 3px;
  }
  .env-label {
    font-weight: 600;
    font-size: 0.85rem;
  }
  .env-label.ar {
    font-family: var(--font-serif);
  }
  .env-badge {
    font-size: 0.6rem;
    background: #333;
    color: var(--fg-muted);
    padding: 1px 5px;
    border-radius: 3px;
    font-family: var(--font-mono);
  }
  .btn-insert {
    background: var(--accent);
    color: #fff;
    border: none;
    padding: 4px 14px;
    border-radius: 5px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8rem;
    transition: filter 0.15s;
    flex-shrink: 0;
  }
  .btn-insert:hover:not(:disabled) {
    filter: brightness(1.15);
  }
  .btn-insert:disabled {
    opacity: 0.5;
    cursor: default;
  }

  /* Custom column */
  .env-col-custom .col-body {
    gap: 12px;
  }
  .custom-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .custom-label {
    font-size: 0.78rem;
    color: var(--fg-muted);
    font-weight: 600;
  }
  .custom-input {
    width: 100%;
    background: #2a2a2a;
    border: 1px solid var(--border);
    color: var(--fg);
    padding: 6px 10px;
    border-radius: 5px;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    box-sizing: border-box;
  }
  .custom-input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .custom-input::placeholder {
    color: #555;
  }
  .color-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .color-picker {
    width: 36px;
    height: 36px;
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 2px;
    background: #2a2a2a;
    cursor: pointer;
  }
  .color-picker::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  .color-picker::-webkit-color-swatch {
    border: none;
    border-radius: 3px;
  }
  .color-value {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--fg-muted);
  }
  .custom-checkbox {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 0.85rem;
  }
  .custom-checkbox input {
    accent-color: var(--accent);
    width: 16px;
    height: 16px;
    cursor: pointer;
  }
  .btn-custom-insert {
    width: 100%;
    padding: 7px 0;
    font-size: 0.85rem;
    margin-top: 4px;
  }
</style>
