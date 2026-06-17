<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { noteContent } from '$lib/stores';
  import katex from 'katex';
  import { parseEquationsFromText } from '$lib/markdown';
  import type { EquationInfo } from '$lib/markdown';

  export let insertAtCursor: (text: string) => void;

  const dispatch = createEventDispatcher<{ close: void }>();

  let equationInput = '';
  let previewHtml = '';
  let previewError = false;
  let documentEquations: Array<{ number: number; latex: string; preview: string }> = [];
  let galleryExpanded: Record<string, boolean> = {};
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

  function insertGalleryItem(latex: string) {
    equationInput += latex;
    inputRef?.focus();
  }

  function toggleGallery(name: string) {
    galleryExpanded = { ...galleryExpanded, [name]: !galleryExpanded[name] };
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { dispatch('close'); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); addEquation(); return; }
  }

  interface GalleryItem { label: string; latex: string }
  interface GalleryCategory { name: string; label: string; items: GalleryItem[] }

  const galleryData: GalleryCategory[] = [
    {
      name: 'fractions',
      label: 'الكسور والجذور',
      items: [
        { label: '\\frac{a}{b}', latex: '\\frac{}{}' },
        { label: '\\sqrt{x}', latex: '\\sqrt{}' },
        { label: '\\sqrt[n]{x}', latex: '\\sqrt[]{}' },
        { label: '\\tfrac{a}{b}', latex: '\\tfrac{}{}' },
      ],
    },
    {
      name: 'greek',
      label: 'الحروف اليونانية',
      items: [
        { label: '\\alpha', latex: '\\alpha' },
        { label: '\\beta', latex: '\\beta' },
        { label: '\\gamma', latex: '\\gamma' },
        { label: '\\theta', latex: '\\theta' },
        { label: '\\lambda', latex: '\\lambda' },
        { label: '\\mu', latex: '\\mu' },
        { label: '\\pi', latex: '\\pi' },
        { label: '\\sigma', latex: '\\sigma' },
        { label: '\\phi', latex: '\\phi' },
        { label: '\\omega', latex: '\\omega' },
        { label: '\\Gamma', latex: '\\Gamma' },
        { label: '\\Delta', latex: '\\Delta' },
        { label: '\\Theta', latex: '\\Theta' },
        { label: '\\Lambda', latex: '\\Lambda' },
        { label: '\\Pi', latex: '\\Pi' },
        { label: '\\Sigma', latex: '\\Sigma' },
        { label: '\\Phi', latex: '\\Phi' },
        { label: '\\Omega', latex: '\\Omega' },
      ],
    },
    {
      name: 'integrals',
      label: 'التكاملات والمجاميع',
      items: [
        { label: '\\int', latex: '\\int' },
        { label: '\\int_{a}^{b}', latex: '\\int_{}^{}' },
        { label: '\\iint', latex: '\\iint' },
        { label: '\\iiint', latex: '\\iiint' },
        { label: '\\oint', latex: '\\oint' },
        { label: '\\sum', latex: '\\sum' },
        { label: '\\sum_{i=0}^{n}', latex: '\\sum_{i=0}^{n}' },
        { label: '\\prod', latex: '\\prod' },
        { label: '\\lim', latex: '\\lim' },
        { label: '\\lim_{x \\to 0}', latex: '\\lim_{x \\to 0}' },
      ],
    },
    {
      name: 'operators',
      label: 'العوامل',
      items: [
        { label: '\\sin', latex: '\\sin' },
        { label: '\\cos', latex: '\\cos' },
        { label: '\\tan', latex: '\\tan' },
        { label: '\\log', latex: '\\log' },
        { label: '\\ln', latex: '\\ln' },
        { label: '\\exp', latex: '\\exp' },
        { label: '\\max', latex: '\\max' },
        { label: '\\min', latex: '\\min' },
        { label: '\\det', latex: '\\det' },
        { label: '\\arg', latex: '\\arg' },
        { label: '\\sinh', latex: '\\sinh' },
        { label: '\\cosh', latex: '\\cosh' },
        { label: '\\tanh', latex: '\\tanh' },
      ],
    },
    {
      name: 'brackets',
      label: 'الأقواس والمحددات',
      items: [
        { label: '\\left( \\right)', latex: '\\left( \\right)' },
        { label: '\\left[ \\right]', latex: '\\left[ \\right]' },
        { label: '\\left\\{ \\right\\}', latex: '\\left\\{ \\right\\}' },
        { label: '\\langle \\rangle', latex: '\\langle \\rangle' },
        { label: '|x|', latex: '|x|' },
        { label: '\\|x\\|', latex: '\\|x\\|' },
        { label: '\\lfloor \\rfloor', latex: '\\lfloor \\rfloor' },
        { label: '\\lceil \\rceil', latex: '\\lceil \\rceil' },
      ],
    },
    {
      name: 'accents',
      label: 'علامات التشكيل',
      items: [
        { label: '\\hat{x}', latex: '\\hat{x}' },
        { label: '\\bar{x}', latex: '\\bar{x}' },
        { label: '\\vec{x}', latex: '\\vec{x}' },
        { label: '\\dot{x}', latex: '\\dot{x}' },
        { label: '\\ddot{x}', latex: '\\ddot{x}' },
        { label: '\\tilde{x}', latex: '\\tilde{x}' },
        { label: '\\overline{abc}', latex: '\\overline{}' },
        { label: '\\underline{abc}', latex: '\\underline{}' },
        { label: '\\widehat{abc}', latex: '\\widehat{}' },
      ],
    },
    {
      name: 'matrices',
      label: 'المصفوفات',
      items: [
        { label: '\\begin{matrix}', latex: '\\begin{matrix}\n  & \\\\\n  & \n\\end{matrix}' },
        { label: '\\begin{pmatrix}', latex: '\\begin{pmatrix}\n  & \\\\\n  & \n\\end{pmatrix}' },
        { label: '\\begin{bmatrix}', latex: '\\begin{bmatrix}\n  & \\\\\n  & \n\\end{bmatrix}' },
        { label: '\\begin{cases}', latex: '\\begin{cases}\n  \\\\\n\\end{cases}' },
        { label: '\\begin{aligned}', latex: '\\begin{aligned}\n  &= \\\\\n  &= \n\\end{aligned}' },
      ],
    },
    {
      name: 'arrows',
      label: 'الأسهم',
      items: [
        { label: '\\to', latex: '\\to' },
        { label: '\\rightarrow', latex: '\\rightarrow' },
        { label: '\\leftarrow', latex: '\\leftarrow' },
        { label: '\\Rightarrow', latex: '\\Rightarrow' },
        { label: '\\Leftarrow', latex: '\\Leftarrow' },
        { label: '\\mapsto', latex: '\\mapsto' },
        { label: '\\implies', latex: '\\implies' },
        { label: '\\iff', latex: '\\iff' },
        { label: '\\longmapsto', latex: '\\longmapsto' },
      ],
    },
    {
      name: 'symbols',
      label: 'الرموز',
      items: [
        { label: '\\infty', latex: '\\infty' },
        { label: '\\partial', latex: '\\partial' },
        { label: '\\nabla', latex: '\\nabla' },
        { label: '\\forall', latex: '\\forall' },
        { label: '\\exists', latex: '\\exists' },
        { label: '\\emptyset', latex: '\\emptyset' },
        { label: '\\subset', latex: '\\subset' },
        { label: '\\supset', latex: '\\supset' },
        { label: '\\cap', latex: '\\cap' },
        { label: '\\cup', latex: '\\cup' },
        { label: '\\in', latex: '\\in' },
        { label: '\\notin', latex: '\\notin' },
        { label: '\\approx', latex: '\\approx' },
        { label: '\\equiv', latex: '\\equiv' },
        { label: '\\ne', latex: '\\ne' },
        { label: '\\le', latex: '\\le' },
        { label: '\\ge', latex: '\\ge' },
        { label: '\\times', latex: '\\times' },
        { label: '\\div', latex: '\\div' },
        { label: '\\pm', latex: '\\pm' },
        { label: '\\circ', latex: '\\circ' },
        { label: '\\propto', latex: '\\propto' },
        { label: '\\therefore', latex: '\\therefore' },
        { label: '\\because', latex: '\\because' },
        { label: '\\cdot', latex: '\\cdot' },
        { label: '\\cdots', latex: '\\cdots' },
        { label: '\\vdots', latex: '\\vdots' },
        { label: '\\ddots', latex: '\\ddots' },
      ],
    },
  ];


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
          {#each galleryData as cat}
            <div class="gallery-category">
              <button
                class="gallery-header"
                on:click={() => toggleGallery(cat.name)}
              >
                <svg
                  class="gallery-chevron"
                  class:rotated={galleryExpanded[cat.name]}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  fill="none"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span>{cat.label}</span>
              </button>
              {#if galleryExpanded[cat.name]}
                <div class="gallery-items">
                  {#each cat.items as item}
                    <button class="gallery-item" on:click={() => insertGalleryItem(item.latex)}>
                      <code>{item.label}</code>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
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
  .gallery-category {
    margin-bottom: 2px;
  }
  .gallery-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    background: none;
    border: none;
    color: var(--fg);
    cursor: pointer;
    padding: 5px 8px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.82rem;
    text-align: start;
    transition: background 0.15s;
  }
  .gallery-header:hover {
    background: var(--bg-hover);
  }
  .gallery-chevron {
    width: 12px;
    height: 12px;
    transition: transform 0.2s;
    flex-shrink: 0;
  }
  .gallery-chevron.rotated {
    transform: rotate(90deg);
  }
  .gallery-items {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 8px 6px 20px;
  }
  .gallery-item {
    background: #2a2a2a;
    border: 1px solid var(--border);
    color: var(--fg);
    cursor: pointer;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 0.78rem;
    font-family: var(--font-mono);
    transition: background 0.15s, border-color 0.15s;
  }
  .gallery-item:hover {
    background: #3a3a3a;
    border-color: var(--accent);
  }
  .gallery-item code {
    font-family: inherit;
    font-size: inherit;
    background: none;
    padding: 0;
    color: inherit;
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
