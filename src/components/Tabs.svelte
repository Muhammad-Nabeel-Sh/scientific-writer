<script lang="ts">
  import { openTabList, activeTabId, activeNoteId } from '$lib/stores';

  export let switchToTab: (id: string) => void;
  export let onCloseTab: (id: string) => void;

  $: tabs = $openTabList;
  $: active = $activeTabId;
  $: currentNoteId = $activeNoteId;

  function onMouseDown(e: MouseEvent, id: string) {
    if (e.button === 1) {
      e.preventDefault();
      onCloseTab(id);
    }
  }

  function onKeydown(e: KeyboardEvent, id: string) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      onCloseTab(id);
    }
  }
</script>

<div class="tab-bar" dir="rtl">
  {#if tabs.length === 0}
    <span class="tab-empty">افتح ملاحظة من الشجرة الجانبية</span>
  {:else}
    <div class="tab-list">
      {#each tabs as tab (tab.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <button
          class="tab"
          class:active={tab.id === active}
          on:click={() => switchToTab(tab.id)}
          on:mousedown={(e) => onMouseDown(e, tab.id)}
          on:keydown={(e) => onKeydown(e, tab.id)}
          role="tab"
          aria-selected={tab.id === active}
          title={tab.name}
        >
          <span class="tab-name">{tab.name}</span>
          <span
            class="tab-indicator"
            class:dirty={tab.dirty}
            class:active-dot={tab.id === active && !tab.dirty}
          ></span>
          <!-- svelte-ignore a11y_interactive_supports_focus -->
          <span
            class="tab-close"
            on:click|stopPropagation={() => onCloseTab(tab.id)}
            on:keydown
            role="button"
            tabindex="-1"
            aria-label="إغلاق"
          >✕</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tab-bar {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    background: var(--bg);
    min-height: 36px;
  }
  .tab-empty {
    padding: 8px 16px;
    font-size: 0.8rem;
    color: var(--fg-muted);
  }
  .tab-list {
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    flex: 1;
    gap: 0;
    scrollbar-width: thin;
  }
  .tab-list::-webkit-scrollbar { height: 2px; }
  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: none;
    border: none;
    border-left: 1px solid var(--border);
    color: var(--fg-muted);
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
    font-size: 0.82rem;
    transition: background 0.12s, color 0.12s;
    flex-shrink: 0;
    position: relative;
  }
  .tab:last-child {
    border-left: none;
  }
  .tab:hover {
    background: var(--bg-hover);
    color: var(--fg);
  }
  .tab.active {
    background: var(--bg-panel);
    color: var(--fg);
    border-bottom: 2px solid var(--accent);
  }
  .tab-name {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tab-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .tab-indicator.dirty {
    background: var(--accent);
  }
  .tab-indicator.active-dot {
    background: transparent;
  }
  .tab-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 3px;
    font-size: 0.65rem;
    color: var(--fg-muted);
    opacity: 0;
    transition: opacity 0.12s, background 0.12s;
    flex-shrink: 0;
  }
  .tab:hover .tab-close,
  .tab.active .tab-close {
    opacity: 1;
  }
  .tab-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--fg);
  }
</style>
