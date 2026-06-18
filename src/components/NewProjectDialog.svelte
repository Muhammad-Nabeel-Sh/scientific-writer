<script lang="ts">
  import { getAllTemplates, getTemplate } from "$lib/templates";
  import type { Template } from "$lib/templates";
  import { hierarchy } from "$lib/stores";
  import { writeNote, saveHierarchy } from "$lib/fs";

  export let show = false;

  let selectedId = "";
  let projectName = "";
  let applying = false;
  let error = "";

  const templates = getAllTemplates();

  $: selectedTemplate = selectedId ? getTemplate(selectedId) : null;

  $: if (selectedTemplate) {
    const defaultNames: Record<string, string> = {
      thesis: "رسالة علمية",
      article: "بحث علمي",
      book: "كتاب",
      lecture: "محاضرات",
    };
    projectName = defaultNames[selectedTemplate.id] || selectedTemplate.name;
  }

  function close() {
    if (applying) return;
    show = false;
    selectedId = "";
    projectName = "";
    error = "";
  }

  async function apply() {
    if (!selectedTemplate || !projectName.trim()) return;
    applying = true;
    error = "";

    try {
      const { tree, samples } = selectedTemplate.generate();

      // Create a root project folder wrapping the generated tree
      const rootId = crypto.randomUUID();
      const rootFolder = {
        id: rootId,
        name: projectName.trim(),
        type: 'folder' as const,
        expanded: true,
        children: tree,
      };

      // Write all sample note files
      for (const [noteId, content] of Object.entries(samples)) {
        await writeNote(noteId, content);
      }

      // Add the project folder to the hierarchy root
      $hierarchy = [...$hierarchy, rootFolder];
      await saveHierarchy($hierarchy);

      close();
    } catch (e) {
      error = `حدث خطأ أثناء إنشاء المشروع: ${e}`;
    } finally {
      applying = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  import { onMount } from "svelte";
  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
</script>

{#if show}
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="overlay" on:click={close} role="presentation">
  <div class="dialog" on:click|stopPropagation role="dialog" tabindex="-1" dir="rtl">
    <div class="dialog-header">
      <h2>مشروع جديد</h2>
      <button class="close-btn" on:click={close} disabled={applying}>✕</button>
    </div>

    <div class="dialog-body">
      {#if error}
        <div class="error-msg">{error}</div>
      {/if}

      <section class="setting-group">
        <h3>اختر قالباً للمشروع</h3>
        <div class="template-grid">
          {#each templates as t (t.id)}
            <button
              class="template-card"
              class:selected={selectedId === t.id}
              on:click={() => (selectedId = t.id)}
              disabled={applying}
            >
              <div class="template-icon">
                {#if t.id === 'thesis'}
                  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                    <line x1="8" y1="7" x2="16" y2="7" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                {:else if t.id === 'article'}
                  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                {:else if t.id === 'book'}
                  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
                  </svg>
                {:else if t.id === 'lecture'}
                  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5" />
                  </svg>
                {/if}
              </div>
              <div class="template-name">{t.name}</div>
              <div class="template-desc">{t.description}</div>
            </button>
          {/each}
        </div>
      </section>

      {#if selectedTemplate}
        <section class="setting-group">
          <h3>اسم المشروع</h3>
          <input
            class="project-name-input"
            type="text"
            bind:value={projectName}
            placeholder="أدخل اسم المشروع"
            disabled={applying}
          />
        </section>
      {/if}
    </div>

    <div class="dialog-footer">
      <button class="btn btn-cancel" on:click={close} disabled={applying}>إلغاء</button>
      <button
        class="btn btn-primary"
        on:click={apply}
        disabled={!selectedTemplate || !projectName.trim() || applying}
      >
        {applying ? 'جارٍ الإنشاء...' : 'إنشاء المشروع'}
      </button>
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
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .dialog {
    background: #fff;
    color: #1a1a1a;
    border-radius: 12px;
    width: min(90vw, 560px);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #eee;
  }
  .dialog-header h2 {
    margin: 0;
    font-size: 1.1rem;
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
  .close-btn:hover {
    background: #f0f0f0;
    color: #333;
  }
  .dialog-body {
    padding: 1rem 1.25rem;
    overflow-y: auto;
    flex: 1;
  }
  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid #eee;
  }
  .setting-group {
    margin-bottom: 1.25rem;
  }
  .setting-group h3 {
    margin: 0 0 0.6rem;
    font-size: 0.95rem;
    color: #555;
    border-bottom: 1px solid #eee;
    padding-bottom: 0.3rem;
  }
  .error-msg {
    background: #fce4e4;
    color: #c00;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.85rem;
    margin-bottom: 1rem;
  }
  .template-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .template-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 1rem;
    border: 2px solid #e0e0e0;
    border-radius: 10px;
    background: #fafafa;
    cursor: pointer;
    transition: all 0.15s;
    text-align: center;
    font-family: inherit;
  }
  .template-card:hover {
    border-color: #1a73e8;
    background: #f0f6ff;
  }
  .template-card.selected {
    border-color: #1a73e8;
    background: #e8f0fe;
  }
  .template-card:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .template-icon svg {
    width: 32px;
    height: 32px;
    color: #555;
  }
  .template-card.selected .template-icon svg {
    color: #1a73e8;
  }
  .template-name {
    font-weight: 700;
    font-size: 0.95rem;
    color: #333;
  }
  .template-desc {
    font-size: 0.75rem;
    color: #777;
    line-height: 1.3;
  }
  .project-name-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.95rem;
    border: 1px solid #ccc;
    border-radius: 6px;
    outline: none;
    font-family: inherit;
    box-sizing: border-box;
  }
  .project-name-input:focus {
    border-color: #1a73e8;
    box-shadow: 0 0 0 2px rgba(26,115,232,0.15);
  }
  .btn {
    padding: 0.5rem 1.25rem;
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
    border: none;
    font-family: inherit;
    transition: background 0.15s;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn-cancel {
    background: #f0f0f0;
    color: #555;
  }
  .btn-cancel:hover:not(:disabled) {
    background: #e0e0e0;
  }
  .btn-primary {
    background: #1a73e8;
    color: #fff;
  }
  .btn-primary:hover:not(:disabled) {
    background: #1557b0;
  }
</style>
