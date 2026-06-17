<script lang="ts">
  import { noteContent, hierarchy } from '$lib/stores';
  import type { TreeNode } from '$lib/stores';
  import { computeStats, addStats } from '$lib/stats';
  import type { NoteStats } from '$lib/stats';
  import { readNote } from '$lib/fs';

  let expanded = true;

  const labels: [keyof NoteStats, string][] = [
    ['words', 'عدد الكلمات'],
    ['characters', 'عدد الأحرف'],
    ['paragraphs', 'عدد الفقرات'],
    ['headings', 'عدد العناوين'],
    ['images', 'عدد الصور'],
    ['figures', 'عدد الأشكال'],
    ['tables', 'عدد الجداول'],
  ];

  $: currentStats = computeStats($noteContent);

  let workspaceStats: NoteStats = $noteContent ? computeStats($noteContent) : { words: 0, characters: 0, paragraphs: 0, headings: 0, images: 0, figures: 0, tables: 0 };
  let wsLoading = false;

  function collectNoteIds(nodes: TreeNode[]): string[] {
    const ids: string[] = [];
    for (const node of nodes) {
      if (node.type === 'note') ids.push(node.id);
      if (node.children) ids.push(...collectNoteIds(node.children));
    }
    return ids;
  }

  async function refreshWorkspace() {
    wsLoading = true;
    const ids = collectNoteIds($hierarchy);
    let total: NoteStats = { words: 0, characters: 0, paragraphs: 0, headings: 0, images: 0, figures: 0, tables: 0 };
    for (const id of ids) {
      try {
        const content = await readNote(id);
        total = addStats(total, computeStats(content));
      } catch { /* skip unreadable notes */ }
    }
    workspaceStats = total;
    wsLoading = false;
  }

  let prevHierarchyJson = '';
  $: if (JSON.stringify($hierarchy) !== prevHierarchyJson) {
    prevHierarchyJson = JSON.stringify($hierarchy);
    refreshWorkspace();
  }
</script>

<div class="stats-section">
  <button class="stats-header" on:click={() => (expanded = !expanded)}>
    <svg class="chevron" class:rotated={expanded} viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
    <span>الإحصائيات</span>
  </button>
  {#if expanded}
    <div class="stats-content">
      <div class="stats-subsection">
        <div class="stats-subheader">الملاحظة الحالية</div>
        {#each labels as [key, label]}
          <div class="stat-row">
            <span class="stat-value">{currentStats[key]}</span>
            <span class="stat-label">{label}</span>
          </div>
        {/each}
      </div>
      <div class="stats-subsection">
        <div class="stats-subheader">
          <span>مساحة العمل</span>
          <button class="refresh-btn" title="تحديث" on:click={refreshWorkspace}>
            <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
        {#if wsLoading}
          <div class="stat-loading">جاري الحساب...</div>
        {:else}
          {#each labels as [key, label]}
            <div class="stat-row">
              <span class="stat-value">{workspaceStats[key]}</span>
              <span class="stat-label">{label}</span>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .stats-section {
    border-top: 1px solid var(--border);
    margin-top: 8px;
    padding-top: 8px;
  }
  .stats-header {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: var(--fg-muted);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    width: 100%;
    text-align: start;
    transition: background 0.15s;
  }
  .stats-header:hover {
    background: var(--bg-hover);
    color: var(--fg);
  }
  .chevron {
    width: 14px;
    height: 14px;
    transition: transform 0.2s;
    flex-shrink: 0;
  }
  .chevron.rotated {
    transform: rotate(90deg);
  }
  .stats-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 6px;
  }
  .stats-subsection {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .stats-subheader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--accent);
    padding: 2px 8px;
    margin-bottom: 2px;
  }
  .stat-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 10px;
    font-size: 0.8rem;
  }
  .stat-label {
    color: var(--fg-muted);
  }
  .stat-value {
    color: var(--fg);
    font-family: var(--font-mono);
    direction: ltr;
    unicode-bidi: isolate;
  }
  .stat-loading {
    color: var(--fg-muted);
    font-size: 0.8rem;
    padding: 4px 10px;
  }
  .refresh-btn {
    background: none;
    border: none;
    color: var(--fg-muted);
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    transition: color 0.15s;
  }
  .refresh-btn:hover {
    color: var(--fg);
  }
</style>
