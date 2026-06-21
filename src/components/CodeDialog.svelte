<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import hljs from 'highlight.js';
  import { highlightTheme } from "$lib/stores";

  export let insertAtCursor: (text: string) => void;

  const dispatch = createEventDispatcher<{ close: void }>();

  const languages = [
    { value: '', label: '— بدون —' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python', label: 'Python' },
    { value: 'rust', label: 'Rust' },
    { value: 'cpp', label: 'C++' },
    { value: 'c', label: 'C' },
    { value: 'csharp', label: 'C#' },
    { value: 'java', label: 'Java' },
    { value: 'go', label: 'Go' },
    { value: 'ruby', label: 'Ruby' },
    { value: 'php', label: 'PHP' },
    { value: 'swift', label: 'Swift' },
    { value: 'kotlin', label: 'Kotlin' },
    { value: 'bash', label: 'Bash' },
    { value: 'powershell', label: 'PowerShell' },
    { value: 'sql', label: 'SQL' },
    { value: 'r', label: 'R' },
    { value: 'matlab', label: 'MATLAB' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'scss', label: 'SCSS' },
    { value: 'xml', label: 'XML' },
    { value: 'json', label: 'JSON' },
    { value: 'yaml', label: 'YAML' },
    { value: 'markdown', label: 'Markdown' },
    { value: 'latex', label: 'LaTeX' },
    { value: 'diff', label: 'Diff' },
    { value: 'dockerfile', label: 'Dockerfile' },
    { value: 'plaintext', label: 'Plain Text' },
  ];

  const themes = [
    { value: 'github', label: 'GitHub', file: 'github.css' },
    { value: 'github-dark', label: 'GitHub Dark', file: 'github-dark.css' },
    { value: 'atom-one-dark', label: 'Atom One Dark', file: 'atom-one-dark.css' },
    { value: 'atom-one-light', label: 'Atom One Light', file: 'atom-one-light.css' },
    { value: 'monokai', label: 'Monokai', file: 'monokai.css' },
    { value: 'dracula', label: 'Dracula', file: 'dracula.css' },
    { value: 'nord', label: 'Nord', file: 'nord.css' },
    { value: 'vs', label: 'Visual Studio', file: 'vs.css' },
    { value: 'vs2015', label: 'Visual Studio 2015 Dark', file: 'vs2015.css' },
    { value: 'androidstudio', label: 'Android Studio', file: 'androidstudio.css' },
  ];

  let selectedLang = '';
  let customLang = '';
  let code = '';
  let previewHtml = '';
  let selectedTheme = themes[0].value;
  let themeStyleEl: HTMLStyleElement | null = null;
  let overlayEl: HTMLDivElement;
  let codeTextarea: HTMLTextAreaElement;

  $: langTag = selectedLang || customLang;

  const themeRawModules: Record<string, { default: string }> = import.meta.glob(
    '/node_modules/highlight.js/styles/*.css',
    { eager: true, query: '?raw' },
  );

  function getThemeCss(themeValue: string): string {
    const entry = themes.find(t => t.value === themeValue);
    if (!entry) return '';
    const key = Object.keys(themeRawModules).find(k => k.endsWith(entry.file));
    return key ? themeRawModules[key].default : '';
  }

  function loadThemeCss(theme: string) {
    if (themeStyleEl) themeStyleEl.remove();
    const css = getThemeCss(theme);
    if (!css) return;
    themeStyleEl = document.createElement('style');
    themeStyleEl.textContent = css;
    document.head.appendChild(themeStyleEl);
  }

  $: if (selectedTheme) {
    loadThemeCss(selectedTheme);
    $highlightTheme = selectedTheme;
  }

  function renderPreview() {
    if (!code.trim()) {
      previewHtml = '<span style="color:var(--fg-muted)">سيظهر الكود هنا</span>';
      return;
    }
    try {
      if (selectedLang && hljs.getLanguage(selectedLang)) {
        const result = hljs.highlight(code, { language: selectedLang, ignoreIllegals: true });
        previewHtml = `<pre dir="auto"><code class="hljs">${result.value}</code></pre>`;
      } else {
        previewHtml = `<pre dir="auto"><code class="hljs">${hljs.highlightAuto(code).value}</code></pre>`;
      }
    } catch {
      previewHtml = `<pre dir="auto"><code class="hljs">${code}</code></pre>`;
    }
  }

  $: if (code || selectedLang) renderPreview();

  function insert() {
    const tag = langTag;
    const block = tag ? `\n\`\`\`${tag}\n${code}\n\`\`\`\n` : `\n\`\`\`\n${code}\n\`\`\`\n`;
    insertAtCursor(block);
    cleanup();
    dispatch('close');
  }

  function cleanup() {
    if (themeStyleEl) themeStyleEl.remove();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { cleanup(); dispatch('close'); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); insert(); return; }
  }

  onMount(() => {
    codeTextarea?.focus();
    loadThemeCss(selectedTheme);
    return cleanup;
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={overlayEl}
  class="code-overlay"
  on:click={() => { cleanup(); dispatch('close'); }}
  on:keydown
  role="presentation"
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="code-dialog" on:click|stopPropagation on:keydown={onKeydown} role="dialog" tabindex="-1">
    <div class="code-header">
      <h3>كتلة كود</h3>
      <button class="close-btn" on:click={() => { cleanup(); dispatch('close'); }}>✕</button>
    </div>

    <div class="code-body">
      <div class="code-controls">
        <label class="control-group">
          <span class="control-label">اللغة</span>
          <select bind:value={selectedLang} class="code-select">
            {#each languages as lang}
              <option value={lang.value}>{lang.label}</option>
            {/each}
          </select>
        </label>
        <label class="control-group">
          <span class="control-label">لغة مخصصة</span>
          <input
            type="text"
            bind:value={customLang}
            class="code-input"
            placeholder="مثال: csharp, mylang..."
            disabled={!!selectedLang}
          />
        </label>
        <label class="control-group">
          <span class="control-label">نمط الإبراز</span>
          <select bind:value={selectedTheme} class="code-select">
            {#each themes as theme}
              <option value={theme.value}>{theme.label}</option>
            {/each}
          </select>
        </label>
      </div>

      <div class="code-editor-area">
        <textarea
          bind:this={codeTextarea}
          bind:value={code}
          class="code-textarea"
          placeholder="اكتب الكود هنا..."
          dir="ltr"
          rows="8"
        ></textarea>
        <div class="code-preview" dir="auto">
          {@html previewHtml}
        </div>
      </div>

      <div class="code-actions">
        <button class="btn-insert" disabled={!code.trim()} on:click={insert}>إدراج</button>
        <span class="code-hint">Ctrl+Enter للإدراج</span>
      </div>
    </div>
  </div>
</div>

<style>
  .code-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }
  .code-dialog {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    width: min(90vw, 700px);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }
  .code-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem 0;
    flex-shrink: 0;
  }
  .code-header h3 {
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
  .code-body {
    padding: 1rem 1.25rem;
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .code-controls {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    flex-shrink: 0;
  }
  .control-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 140px;
    flex: 1;
  }
  .control-label {
    font-size: 0.8rem;
    color: var(--fg-muted);
  }
  .code-select {
    font-size: 0.85rem;
    padding: 5px 8px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: #2a2a2a;
    color: var(--fg);
    font-family: inherit;
  }
  .code-input {
    font-size: 0.85rem;
    padding: 5px 8px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: #2a2a2a;
    color: var(--fg);
    font-family: var(--font-mono);
  }
  .code-input:disabled {
    opacity: 0.4;
  }
  .code-input:focus,
  .code-select:focus {
    outline: none;
    border-color: var(--accent);
  }
  .code-editor-area {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    min-height: 0;
  }
  .code-textarea {
    width: 100%;
    background: #1a1a1a;
    border: 1px solid var(--border);
    color: var(--fg);
    padding: 0.6rem;
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    direction: ltr;
    resize: vertical;
    min-height: 80px;
  }
  .code-textarea:focus {
    outline: none;
    border-color: var(--accent);
  }
  .code-preview {
    min-height: 80px;
    max-height: 250px;
    padding: 0.6rem;
    background: #1a1a1a;
    border-radius: 6px;
    border: 1px solid var(--border);
    overflow: auto;
  }
  .code-preview :global(pre) {
    margin: 0;
    white-space: pre-wrap;
  }
  .code-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    padding-top: 0.25rem;
  }
  .btn-insert {
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
  .btn-insert:hover:not(:disabled) {
    filter: brightness(1.15);
  }
  .btn-insert:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .code-hint {
    font-size: 0.7rem;
    color: var(--fg-muted);
  }
</style>
