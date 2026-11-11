<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { noteContent } from '$lib/stores';
  import { sanitizeHtml } from '$lib/sanitize';
  import { analyzeMarkdown } from '$lib/markdown';
  import { renderMath, buildEquationSnippet, labelError, type EquationDir } from '$lib/math';
  import KatexGallery from './KatexGallery.svelte';
  import ArabicSymbolGallery from './ArabicSymbolGallery.svelte';

  export let insertAtCursor: (text: string) => void;

  const dispatch = createEventDispatcher<{ close: void }>();

  interface DocEquation {
    number: number;
    latex: string;
    preview: string;
    label?: string;
    warnings: string[];
  }

  let equationInput = '';
  let previewHtml = '';
  let previewError = false;
  let documentEquations: DocEquation[] = [];
  let inputRef: HTMLTextAreaElement;

  // Options
  const OPTIONS_KEY = 'sw_equation_options';
  let dir: EquationDir = 'ltr';
  let display = true;
  let label = '';
  let galleryTab: 'arabic' | 'latex' = 'arabic';
  try {
    const saved = JSON.parse(localStorage.getItem(OPTIONS_KEY) || '{}');
    if (saved.dir === 'rtl' || saved.dir === 'ltr') dir = saved.dir;
    if (typeof saved.display === 'boolean') display = saved.display;
    if (saved.galleryTab === 'arabic' || saved.galleryTab === 'latex') galleryTab = saved.galleryTab;
  } catch { /* defaults */ }
  $: try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify({ dir, display, galleryTab }));
  } catch { /* storage unavailable */ }

  // Right-to-left math is display-only (there is no inline RTL syntax), and so are labels.
  $: effectiveDir = display ? dir : 'ltr';
  $: labelProblem = display ? labelError(label) : null;

  // Equations and their math diagnostics come from the same parse the preview
  // uses. Warnings are produced by rendering each equation with the shared
  // KaTeX call (analyzeMarkdown itself does not do KaTeX work).
  $: documentEquations = analyzeMarkdown($noteContent).equations.map((eq) => {
    const warnings: string[] = [];
    const preview = renderMath(eq.latex, { display: true, onIssue: (i) => warnings.push(i.message) });
    return {
      number: eq.number,
      latex: eq.latex,
      preview,
      label: eq.label,
      warnings,
    };
  });

  $: if (equationInput.trim()) {
    let failed = false;
    previewHtml = renderMath(equationInput.trim(), {
      display,
      dir: effectiveDir,
      onIssue: (i) => { if (i.code !== 'strict') failed = true; },
    });
    previewError = failed;
  } else {
    previewHtml = '<span style="color:var(--fg-muted)">سيظهر المعاينة هنا</span>';
    previewError = false;
  }

  onMount(() => {
    inputRef?.focus();
  });

  function citeEquation(eq: DocEquation) {
    insertAtCursor(`[ref:eq:${eq.label ?? eq.number}]`);
    dispatch('close');
  }

  function addEquation() {
    if (!equationInput.trim() || labelProblem) return;
    insertAtCursor(buildEquationSnippet({ tex: equationInput, display, dir: effectiveDir, label }));
    dispatch('close');
  }

  /** Insert at the input's caret (not just at the end). */
  function onGalleryInsert(latex: string) {
    const ta = inputRef;
    if (!ta) {
      equationInput += latex;
      return;
    }
    const start = ta.selectionStart ?? equationInput.length;
    const end = ta.selectionEnd ?? equationInput.length;
    equationInput = equationInput.slice(0, start) + latex + equationInput.slice(end);
    const caret = start + latex.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
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
          <div class="eq-options" dir="rtl">
            <div class="opt-group" role="radiogroup" aria-label="اتجاه المعادلة">
              <span class="opt-label">الاتجاه</span>
              <button class="seg" class:active={effectiveDir === 'ltr'} disabled={!display}
                role="radio" aria-checked={effectiveDir === 'ltr'}
                title="الترميز الغربي: من اليسار إلى اليمين"
                on:click={() => (dir = 'ltr')}>يسار ← يمين</button>
              <button class="seg" class:active={effectiveDir === 'rtl'} disabled={!display}
                role="radio" aria-checked={effectiveDir === 'rtl'}
                title="الترميز العربي: من اليمين إلى اليسار (تجريبي) — يُدرج $$[rtl]"
                on:click={() => (dir = 'rtl')}>يمين ← يسار</button>
            </div>
            <div class="opt-group" role="radiogroup" aria-label="نمط الإدراج">
              <span class="opt-label">النمط</span>
              <button class="seg" class:active={display} role="radio" aria-checked={display}
                title="معادلة مستقلة مرقّمة: $$ … $$"
                on:click={() => (display = true)}>مستقلة</button>
              <button class="seg" class:active={!display} role="radio" aria-checked={!display}
                title="ضمن السطر: $ … $"
                on:click={() => (display = false)}>ضمن السطر</button>
            </div>
            <label class="opt-group opt-tag" class:invalid={!!labelProblem}>
              <span class="opt-label">الوسم</span>
              <input
                type="text"
                bind:value={label}
                disabled={!display}
                placeholder="اختياري: مثل سرعة"
                title={labelProblem ?? 'يتيح الإشارة إلى المعادلة بـ [ref:eq:الوسم]'}
                dir="auto"
              />
            </label>
          </div>
          <textarea
            bind:this={inputRef}
            bind:value={equationInput}
            class="eq-input"
            placeholder="اكتب معادلة LaTeX هنا..."
            dir="ltr"
            rows="3"
          ></textarea>
          <div class="eq-preview" dir="ltr">
            {@html sanitizeHtml(previewHtml)}
          </div>
          <div class="eq-actions">
            <button
              class="btn-add"
              disabled={!equationInput.trim() || previewError || !!labelProblem}
              on:click={addEquation}
            >إضافة</button>
            <span class="eq-hint">Ctrl+Enter للإضافة</span>
            {#if labelProblem}<span class="eq-label-error">{labelProblem}</span>{/if}
          </div>
        </div>

        <!-- Gallery -->
        <div class="eq-gallery">
          <div class="gallery-tabs" role="tablist" dir="rtl">
            <button role="tab" class="tab" class:active={galleryTab === 'arabic'} aria-selected={galleryTab === 'arabic'}
              on:click={() => (galleryTab = 'arabic')}>رموز عربية</button>
            <button role="tab" class="tab" class:active={galleryTab === 'latex'} aria-selected={galleryTab === 'latex'}
              on:click={() => (galleryTab = 'latex')}>رموز LaTeX</button>
          </div>
          {#if galleryTab === 'arabic'}
            <ArabicSymbolGallery onInsert={onGalleryInsert} dir={effectiveDir} />
          {:else}
            <KatexGallery onInsert={onGalleryInsert} />
          {/if}
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
                <div class="eq-item-main">
                  <div class="eq-item-preview" dir="ltr">{@html sanitizeHtml(eq.preview)}</div>
                  {#if eq.label}
                    <div class="eq-item-label">#eq:{eq.label}</div>
                  {/if}
                  {#if eq.warnings.length > 0}
                    <div class="eq-item-warnings" dir="rtl">
                      {#each eq.warnings as warning}
                        <span class="eq-warning">⚠ {warning}</span>
                      {/each}
                    </div>
                  {/if}
                </div>
                <button
                  class="btn-cite"
                  title={eq.label ? `إدراج [ref:eq:${eq.label}]` : `إدراج [ref:eq:${eq.number}]`}
                  on:click={() => citeEquation(eq)}
                >
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
  .gallery-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    background: var(--bg-panel);
    z-index: 1;
  }
  .tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--fg-muted);
    padding: 4px 10px;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }
  .tab.active {
    color: var(--fg);
    border-bottom-color: var(--accent);
  }

  /* Options */
  .eq-options {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 14px;
  }
  .opt-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .opt-label {
    font-size: 0.75rem;
    color: var(--fg-muted);
    margin-inline-end: 2px;
  }
  .seg {
    background: #2a2a2a;
    border: 1px solid var(--border);
    color: var(--fg-muted);
    padding: 3px 9px;
    font-family: inherit;
    font-size: 0.75rem;
    border-radius: 5px;
    cursor: pointer;
  }
  .seg.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .seg:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .opt-tag input {
    width: 110px;
    background: #2a2a2a;
    border: 1px solid var(--border);
    color: var(--fg);
    padding: 3px 8px;
    border-radius: 5px;
    font-family: inherit;
    font-size: 0.75rem;
  }
  .opt-tag input:disabled {
    opacity: 0.4;
  }
  .opt-tag.invalid input {
    border-color: #e37400;
  }
  .eq-label-error {
    font-size: 0.72rem;
    color: #f0c674;
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
    align-items: flex-start;
    gap: 8px;
    padding: 8px 10px;
    background: #1a1a1a;
    border-radius: 6px;
    border: 1px solid var(--border);
  }
  .eq-item-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .eq-item-label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--fg-muted);
    direction: ltr;
    unicode-bidi: isolate;
    text-align: start;
  }
  .eq-item-warnings {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: start;
  }
  .eq-warning {
    font-size: 0.72rem;
    color: #f0c674;
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
    width: 100%;
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
