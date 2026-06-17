<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { noteContent } from '$lib/stores';
  import katex from 'katex';
  import { parseEquationsFromText } from '$lib/markdown';
  import type { EquationInfo } from '$lib/markdown';
  import KatexGallery from './KatexGallery.svelte';

  export let insertAtCursor: (text: string) => void;

  const dispatch = createEventDispatcher<{ close: void }>();

  let equationInput = '';
  let previewHtml = '';
  let previewError = false;
  let documentEquations: Array<{ number: number; latex: string; preview: string }> = [];
  let inputRef: HTMLTextAreaElement;

  $: if (equationInput.trim()) {
    try {
      previewHtml = katex.renderToString(equationInput.trim(), { displayMode: true, throwOnError: false });
      previewError = false;
    } catch {
      previewHtml = '<span style="color:#ff6b6b">خطأ في الصياغة</span>';
      previewError = true;
    }
  } else {
    previewHtml = '<span style="color:var(--fg-muted)">سيظهر المعاينة هنا</span>';
    previewError = false;
  }

  onMount(() => {
    inputRef?.focus();
    const eqs = parseEquationsFromText($noteContent);
    documentEquations = eqs.map(eq => ({
      number: eq.number,
      latex: eq.latex,
      preview: renderLatexPreview(eq.latex),
    }));
  });

  function renderLatexPreview(latex: string): string {
    if (!latex || !latex.trim()) return '';
    try {
      return katex.renderToString(latex, { displayMode: true, throwOnError: false });
    } catch {
      return '<span style="color:#ff6b6b">خطأ</span>';
    }
  }

  function addEquation() {
    if (!equationInput.trim()) return;
    insertAtCursor(`\n$$\n${equationInput.trim()}\n$$\n`);
    dispatch('close');
  }

  function citeEquation(number: number) {
    insertAtCursor(`[ref:eq:${number}]`);
    dispatch('close');
  }

  function onGalleryInsert(latex: string) {
    equationInput += latex;
    inputRef?.focus();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { dispatch('close'); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); addEquation(); return; }
  }


</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="eq-overlay" on:click={() => dispatch('close')} on:keydown role="presentation">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="eq-dialog" on:click|stopPropagation on:keydown={onKeydown} role="dialog" tabindex="-1">
    <div class="eq-header">
      <h3>معادلة رياضية</h3>
      <button class="close-btn" on:click={() => dispatch('close')}>✕</button>
    </div>

    <div class="eq-body">
      <!-- Left: Input + Preview + Gallery -->
      <div class="eq-left">
        <div class="eq-input-section">
          <textarea
            bind:this={inputRef}
            bind:value={equationInput}
            class="eq-input"
            placeholder="اكتب معادلة LaTeX هنا..."
            dir="ltr"
            rows="3"
          ></textarea>
          <div class="eq-preview" dir="ltr">
            {@html previewHtml}
          </div>
          <div class="eq-actions">
            <button
              class="btn-add"
              disabled={!equationInput.trim() || previewError}
              on:click={addEquation}
            >إضافة</button>
            <span class="eq-hint">Ctrl+Enter للإضافة</span>
          </div>
        </div>

        <!-- Gallery -->
        <div class="eq-gallery">
          <h4 class="gallery-title">مكتبة الوظائف</h4>
          <KatexGallery onInsert={onGalleryInsert} />
        </div>
      </div>

      <!-- Right: Document equations list -->
      <div class="eq-right">
        <h4>المعادلات في المستند</h4>
        {#if documentEquations.length === 0}
          <div class="eq-empty">لا توجد معادلات في المستند</div>
        {:else}
          <div class="eq-list">
            {#each documentEquations as eq}
              <div class="eq-list-item">
                <div class="eq-item-number">({eq.number})</div>
                <div class="eq-item-preview" dir="ltr">{@html eq.preview}</div>
                <button class="btn-cite" on:click={() => citeEquation(eq.number)}>
                  استشهاد
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .eq-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }
  .eq-dialog {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    width: 900px;
    max-width: 95vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }
  .eq-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1rem 0;
    flex-shrink: 0;
  }
  .eq-header h3 {
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

  .eq-body {
    display: flex;
    gap: 0;
    padding: 1rem;
    overflow: hidden;
    flex: 1;
  }

  /* Left section */
  .eq-left {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: hidden;
    border-inline-end: 1px solid var(--border);
    padding-inline-end: 1rem;
  }
  .eq-input-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;
  }
  .eq-input {
    width: 100%;
    background: #2a2a2a;
    border: 1px solid var(--border);
    color: var(--fg);
    padding: 0.6rem;
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 0.9rem;
    direction: ltr;
    resize: vertical;
    min-height: 60px;
  }
  .eq-input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .eq-preview {
    min-height: 60px;
    padding: 0.75rem;
    background: #1a1a1a;
    border-radius: 6px;
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow-x: auto;
    direction: ltr;
  }
  .eq-preview :global(.katex-display) {
    margin: 0.5em 0;
  }
  .eq-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .btn-add {
    padding: 6px 20px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.9rem;
    background: var(--accent);
    color: #fff;
    transition: filter 0.15s;
  }
  .btn-add:hover:not(:disabled) {
    filter: brightness(1.15);
  }
  .btn-add:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .eq-hint {
    font-size: 0.7rem;
    color: var(--fg-muted);
  }

  /* Gallery */
  .eq-gallery {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }
  .gallery-title {
    font-size: 0.85rem;
    color: var(--fg-muted);
    margin: 0 0 6px;
    font-weight: 600;
  }

  /* Right section */
  .eq-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding-inline-start: 1rem;
    overflow: hidden;
  }
  .eq-right h4 {
    font-size: 0.85rem;
    color: var(--fg-muted);
    margin: 0 0 8px;
    font-weight: 600;
    flex-shrink: 0;
  }
  .eq-empty {
    color: var(--fg-muted);
    font-size: 0.85rem;
    text-align: center;
    padding: 2rem;
  }
  .eq-list {
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .eq-list-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: #1a1a1a;
    border-radius: 6px;
    border: 1px solid var(--border);
  }
  .eq-item-number {
    flex-shrink: 0;
    font-size: 0.8rem;
    color: var(--accent);
    font-family: var(--font-mono);
    min-width: 2em;
    text-align: center;
  }
  .eq-item-preview {
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    display: flex;
    align-items: center;
    direction: ltr;
  }
  .eq-item-preview :global(.katex-display) {
    margin: 0.2em 0;
    font-size: 0.9rem;
  }
  .eq-item-preview :global(.katex) {
    font-size: 0.9rem;
  }
  .btn-cite {
    flex-shrink: 0;
    background: #333;
    border: 1px solid var(--border);
    color: var(--fg);
    cursor: pointer;
    padding: 4px 12px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.78rem;
    transition: background 0.15s;
    white-space: nowrap;
  }
  .btn-cite:hover {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }
</style>
