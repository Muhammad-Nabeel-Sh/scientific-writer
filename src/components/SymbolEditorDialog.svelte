<script lang="ts">
  import { onMount } from 'svelte';
  import { symbolEditorRequest } from '$lib/stores';
  import {
    SYMBOL_CATEGORIES,
    getSymbol,
    getSymbolSource,
    getSymbols,
    isKatexCommand,
    katexExpansion,
    renderMath,
    validateSymbol,
    type GlyphAtom,
    type MathSymbol,
    type SymbolCategory,
  } from '$lib/math';
  import { emptySymbolForm, formFromSymbol, formToSymbol } from '$lib/math/symbol-form';
  import { saveWorkspaceSymbols } from '$lib/math-workspace';
  import { sanitizeHtml } from '$lib/sanitize';

  const CATEGORY_LABELS: Record<SymbolCategory, string> = {
    'arabic-letter': 'حرف عربي رياضي',
    'arabic-function': 'دالة عربية',
    operator: 'عامل',
    relation: 'علاقة',
    arrow: 'سهم',
    unit: 'وحدة',
    misc: 'متنوع',
  };
  const ATOMS: { value: GlyphAtom; label: string }[] = [
    { value: 'mathord', label: 'حرف/رمز عادي (mathord)' },
    { value: 'mathop', label: 'مؤثر (mathop)' },
    { value: 'mathrel', label: 'علاقة (mathrel)' },
    { value: 'mathbin', label: 'عامل ثنائي (mathbin)' },
  ];

  const initialName = $symbolEditorRequest?.name ?? '';
  const existing = initialName && getSymbolSource(initialName) === 'user'
    ? getSymbol(initialName)
    : undefined;

  const form = existing ? formFromSymbol(existing) : emptySymbolForm(initialName);
  let originalName = existing?.name ?? '';
  let name = form.name;
  let labelAr = form.labelAr;
  let keywords = form.keywords;
  let category: SymbolCategory = form.category;
  let kind: 'macro' | 'glyph' = form.kind;
  let macroBody = form.macroBody;
  let glyphChar = form.glyphChar;
  let glyphFont = form.glyphFont;
  let glyphAtom: GlyphAtom = form.glyphAtom;
  let arity: 0 | 1 | 2 = form.arity;
  let latexBody = form.latexBody;

  let nameInput: HTMLInputElement;
  let previewHtml = '';
  let previewIssues: string[] = [];
  let saveError = '';
  let saving = false;
  let candidate: MathSymbol;
  let errors: string[] = [];

  const isEditing = !!existing;

  function previewTex(sym: MathSymbol): string {
    const expansion = katexExpansion(sym);
    if (sym.katex.kind === 'glyph') return expansion;
    const args = ['س', 'ص'];
    return expansion.replace(/#(\d)/g, (_m, n: string) => args[Number(n) - 1] ?? '');
  }

  function admissionErrors(sym: MathSymbol): string[] {
    if (!sym.name) return [];
    const clash = getSymbol(sym.name);
    if (clash && sym.name !== originalName) return [`الرمز \\${sym.name} معرَّف مسبقًا`];
    if (isKatexCommand(sym.name) && sym.name !== originalName) {
      return [`\\${sym.name} أمر موجود في KaTeX؛ اختر اسمًا آخر`];
    }
    return [];
  }

  // Every field is listed here on purpose: Svelte re-runs a `$:` statement only
  // for variables that appear in it. (It used to call buildSymbol(), which read
  // the fields internally, so the candidate never updated and Save stayed disabled.)
  $: candidate = formToSymbol({
    name, labelAr, keywords, category, kind, macroBody, arity, glyphChar, glyphFont, glyphAtom, latexBody,
  });
  $: errors = [...validateSymbol(candidate), ...admissionErrors(candidate)];
  $: {
    const issues: string[] = [];
    const tex = previewTex(candidate);
    previewHtml = tex
      ? sanitizeHtml(renderMath(tex, { display: true, onIssue: (i) => issues.push(`${i.code}: ${i.message}`) }))
      : '';
    previewIssues = issues;
  }

  onMount(() => {
    nameInput?.focus();
  });

  function close() {
    $symbolEditorRequest = null;
  }

  async function save() {
    if (errors.length > 0 || saving) return;
    saving = true;
    saveError = '';
    try {
      const others = getSymbols().filter(
        (s) => getSymbolSource(s.name) === 'user' && s.name !== originalName,
      );
      const problems = await saveWorkspaceSymbols([...others, candidate]);
      if (problems.length > 0) {
        saveError = problems.join('؛ ');
        return;
      }
      close();
    } catch (e) {
      saveError = `تعذّر حفظ الرمز: ${e instanceof Error ? e.message : e}`;
    } finally {
      saving = false;
    }
  }

  async function remove() {
    if (!isEditing || saving) return;
    saving = true;
    saveError = '';
    try {
      const others = getSymbols().filter(
        (s) => getSymbolSource(s.name) === 'user' && s.name !== originalName,
      );
      const problems = await saveWorkspaceSymbols(others);
      if (problems.length > 0) {
        saveError = problems.join('؛ ');
        return;
      }
      close();
    } catch (e) {
      saveError = `تعذّر حذف الرمز: ${e instanceof Error ? e.message : e}`;
    } finally {
      saving = false;
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void save();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="se-overlay" on:click={close} on:keydown={onKeydown} role="presentation">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="se-dialog" on:click|stopPropagation on:keydown={onKeydown} role="dialog" aria-modal="true" tabindex="-1" dir="rtl">
    <div class="se-header">
      <h3>{isEditing ? 'تعديل رمز مخصص' : 'إضافة رمز مخصص'}</h3>
      <button class="close-btn" on:click={close} title="إغلاق">✕</button>
    </div>

    <div class="se-body">
      <div class="se-fields">
        <label class="field">
          <span>الاسم (لاتيني)</span>
          <input bind:this={nameInput} bind:value={name} dir="ltr" placeholder="مثال: jaa أو mySymbol" />
        </label>

        <label class="field">
          <span>التسمية العربية</span>
          <input bind:value={labelAr} dir="auto" placeholder="مثال: جيب الزاوية" />
        </label>

        <label class="field">
          <span>الكلمات المفتاحية (مفصولة بفاصلة)</span>
          <input bind:value={keywords} dir="auto" placeholder="جيب، sin، sine" />
        </label>

        <label class="field">
          <span>التصنيف</span>
          <select bind:value={category}>
            {#each SYMBOL_CATEGORIES as c}
              <option value={c}>{CATEGORY_LABELS[c]}</option>
            {/each}
          </select>
        </label>

        <div class="field">
          <span>طريقة الرسم</span>
          <div class="seg-row">
            <button class="seg" class:active={kind === 'macro'} on:click={() => (kind = 'macro')}>ماكرو KaTeX</button>
            <button class="seg" class:active={kind === 'glyph'} on:click={() => (kind = 'glyph')}>حرف بخط مرفق</button>
          </div>
        </div>

        {#if kind === 'macro'}
          <label class="field">
            <span>جسم الماكرو (يستخدم #1 و #2 عند الحاجة)</span>
            <textarea bind:value={macroBody} dir="ltr" rows="3" placeholder={'\\operatorname{\\text{جا}}'}></textarea>
          </label>
          <label class="field field-small">
            <span>عدد المعاملات</span>
            <select bind:value={arity}>
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>
        {:else}
          <label class="field">
            <span>الحرف/الرمز (Unicode)</span>
            <input bind:value={glyphChar} dir="auto" placeholder="𞸀 أو ∑" />
          </label>
          <div class="field-row">
            <label class="field">
              <span>الخط</span>
              <input bind:value={glyphFont} dir="ltr" placeholder="arabicmath" />
            </label>
            <label class="field">
              <span>نوع الرمز</span>
              <select bind:value={glyphAtom}>
                {#each ATOMS as atom}
                  <option value={atom.value}>{atom.label}</option>
                {/each}
              </select>
            </label>
          </div>
        {/if}

        <label class="field">
          <span>صيغة LaTeX للتصدير (اختياري)</span>
          <input
            bind:value={latexBody}
            dir="ltr"
            placeholder={kind === 'macro' ? 'إن تُرك فارغًا يُستخدم جسم الماكرو' : 'إن تُرك فارغًا يُستخدم الحرف نفسه'}
          />
        </label>
      </div>

      <div class="se-side">
        <span class="side-label">المعاينة</span>
        <div class="se-preview" dir="ltr">
          {#if previewHtml}
            {@html previewHtml}
          {:else}
            <span class="placeholder">لا توجد معاينة بعد</span>
          {/if}
        </div>
        {#if previewIssues.length > 0}
          <div class="se-issues" dir="rtl">
            {#each previewIssues as issue}
              <span>⚠ {issue}</span>
            {/each}
          </div>
        {/if}
        <span class="side-hint">تُحفظ الرموز في <code>math-symbols.json</code> داخل مساحة العمل.</span>
      </div>
    </div>

    {#if errors.length > 0}
      <div class="se-errors" dir="rtl">
        {#each errors as error}
          <div>⚠ {error}</div>
        {/each}
      </div>
    {/if}
    {#if saveError}
      <div class="se-errors" dir="rtl">{saveError}</div>
    {/if}

    <div class="se-actions">
      {#if isEditing}
        <button class="btn-danger" on:click={remove} disabled={saving}>حذف الرمز</button>
      {/if}
      <span class="spacer"></span>
      <button class="btn-cancel" on:click={close}>إلغاء</button>
      <button class="btn-save" on:click={save} disabled={saving || errors.length > 0}>
        {saving ? 'جارٍ الحفظ…' : 'حفظ'}
      </button>
    </div>
  </div>
</div>

<style>
  .se-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 250;
  }
  .se-dialog {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    width: 760px;
    max-width: 95vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
  }
  .se-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.9rem 1rem 0.6rem;
    border-bottom: 1px solid var(--border);
  }
  .se-header h3 {
    margin: 0;
    font-size: 1.05rem;
  }
  .close-btn {
    background: none;
    border: none;
    color: var(--fg-muted);
    cursor: pointer;
    font-size: 1.1rem;
    padding: 4px;
    border-radius: 4px;
  }
  .close-btn:hover {
    color: var(--fg);
    background: var(--bg-hover);
  }
  .se-body {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    overflow-y: auto;
  }
  .se-fields {
    flex: 1.3;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 0.78rem;
    color: var(--fg-muted);
  }
  .field input,
  .field select,
  .field textarea {
    background: #2a2a2a;
    border: 1px solid var(--border);
    color: var(--fg);
    padding: 5px 8px;
    border-radius: 5px;
    font-family: inherit;
    font-size: 0.82rem;
  }
  .field textarea {
    font-family: var(--font-mono);
    resize: vertical;
  }
  .field input:focus,
  .field select:focus,
  .field textarea:focus {
    outline: none;
    border-color: var(--accent);
  }
  .field-row {
    display: flex;
    gap: 8px;
  }
  .field-row .field {
    flex: 1;
  }
  .field-small {
    max-width: 120px;
  }
  .seg-row {
    display: flex;
    gap: 4px;
  }
  .seg {
    background: #2a2a2a;
    border: 1px solid var(--border);
    color: var(--fg-muted);
    padding: 4px 9px;
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
  .se-side {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .side-label {
    font-size: 0.78rem;
    color: var(--fg-muted);
  }
  .se-preview {
    min-height: 120px;
    background: #1a1a1a;
    border: 1px solid var(--border);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow-x: auto;
    padding: 0.5rem;
  }
  .placeholder {
    color: var(--fg-muted);
    font-size: 0.8rem;
  }
  .se-issues {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.72rem;
    color: #f0c674;
  }
  .side-hint {
    font-size: 0.7rem;
    color: var(--fg-muted);
    line-height: 1.5;
  }
  .side-hint code {
    font-family: var(--font-mono);
    direction: ltr;
    unicode-bidi: isolate;
  }
  .se-errors {
    margin: 0 1rem;
    padding: 6px 10px;
    background: #3a2a12;
    border: 1px solid #5a4020;
    border-radius: 5px;
    color: #f0c674;
    font-size: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .se-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0.8rem 1rem;
    border-top: 1px solid var(--border);
  }
  .spacer {
    flex: 1;
  }
  .btn-save,
  .btn-cancel,
  .btn-danger {
    padding: 6px 16px;
    border-radius: 5px;
    border: 1px solid var(--border);
    font-family: inherit;
    font-size: 0.82rem;
    cursor: pointer;
  }
  .btn-save {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .btn-save:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .btn-cancel {
    background: #2a2a2a;
    color: var(--fg);
  }
  .btn-danger {
    background: transparent;
    border-color: #6a3030;
    color: #f08a8a;
  }
  .btn-danger:hover {
    background: #3a1a1a;
  }
</style>
