<script lang="ts">
  import { noteContent, activeHeadingId, editorRef, previewRef, outlineItems } from '$lib/stores';

  let expanded = true;

  $: items = $outlineItems;

  function scrollTo(item: (typeof items)[number]) {
    $activeHeadingId = item.id;

    const editor = $editorRef;
    if (editor) {
      const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 20;
      editor.scrollTop = item.lineIndex * lineHeight;
      editor.focus();
    }

    const preview = $previewRef;
    if (preview) {
      const headings = preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const idx = items.indexOf(item);
      if (headings[idx]) {
        headings[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
</script>

<div class="outline-section">
  <button class="outline-header" on:click={() => (expanded = !expanded)}>
    <svg class="chevron" class:rotated={expanded} viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
    <span>الملخص</span>
  </button>
  {#if expanded}
    <div class="outline-items">
      {#if items.length === 0}
        <div class="empty-msg">لا توجد عناوين</div>
      {:else}
        {#each items as item (item.id)}
          <button
            class="outline-item"
            class:active={$activeHeadingId === item.id}
            style="padding-inline-start: {12 + (item.level - 1) * 16}px"
            on:click={() => scrollTo(item)}
          >
            <span class="level-dot" style="background: hsl({(item.level - 1) * 40}, 70%, 55%)"></span>
            <span class="outline-text">{item.text}</span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .outline-section {
    border-top: 1px solid var(--border);
    margin-top: 8px;
    padding-top: 8px;
  }
  .outline-header {
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
  .outline-header:hover {
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
  .outline-items {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin-top: 4px;
  }
  .outline-item {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: var(--fg-muted);
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
  .outline-item:hover {
    background: var(--bg-hover);
    color: var(--fg);
  }
  .outline-item.active {
    background: var(--accent);
    color: #fff;
  }
  .level-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .outline-text {
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
