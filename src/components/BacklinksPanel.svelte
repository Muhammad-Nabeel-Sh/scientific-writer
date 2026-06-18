<script lang="ts">
  import { activeNoteId, currentBacklinks } from '$lib/stores';

  let expanded = true;

  $: backlinks = $currentBacklinks;

  function navigateTo(id: string) {
    $activeNoteId = id;
  }
</script>

<div class="backlinks-section">
  <button class="backlinks-header" on:click={() => (expanded = !expanded)}>
    <svg class="chevron" class:rotated={expanded} viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
    <span>الروابط الواردة</span>
    {#if backlinks.length > 0}
      <span class="badge">{backlinks.length}</span>
    {/if}
  </button>
  {#if expanded}
    <div class="backlinks-items">
      {#if backlinks.length === 0}
        <div class="empty-msg">لا توجد روابط واردة</div>
      {:else}
        {#each backlinks as link (link.id)}
          <button class="backlink-item" on:click={() => navigateTo(link.id)}>
            <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="link-icon">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
            <span>{link.name}</span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .backlinks-section {
    border-top: 1px solid var(--border);
    margin-top: 8px;
    padding-top: 8px;
  }
  .backlinks-header {
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
  .backlinks-header:hover {
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
  .badge {
    background: var(--accent);
    color: #fff;
    font-size: 0.7rem;
    padding: 0 5px;
    border-radius: 8px;
    min-width: 16px;
    text-align: center;
    line-height: 1.4;
  }
  .backlinks-items {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin-top: 4px;
  }
  .backlink-item {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.85rem;
    font-family: inherit;
    text-align: start;
    width: 100%;
    transition: background 0.15s, color 0.15s;
    overflow: hidden;
  }
  .backlink-item:hover {
    background: var(--bg-hover);
    color: var(--fg);
  }
  .link-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }
  .backlink-item span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .empty-msg {
    color: var(--fg-muted);
    font-size: 0.8rem;
    padding: 6px 10px;
  }
</style>
