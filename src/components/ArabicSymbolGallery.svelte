<script lang="ts">
  import {
    renderMath,
    arabicGalleryGroups,
    filterGallery,
    mathRegistryVersion,
    type GalleryGroup,
    type GalleryItem,
  } from '$lib/math';
  import { sanitizeHtml } from '$lib/sanitize';

  /** Insert TeX into the equation input. */
  export let onInsert: (tex: string) => void;
  /** Direction used to draw the previews (matches the dialog's option). */
  export let dir: 'ltr' | 'rtl' = 'ltr';

  let query = '';
  let expanded: Record<string, boolean> = {};

  // Rebuild when custom symbols change (workspace math-symbols.json).
  let allGroups: GalleryGroup[] = [];
  $: $mathRegistryVersion, (allGroups = arabicGalleryGroups());
  $: {
    const next = { ...expanded };
    let changed = false;
    for (const g of allGroups) {
      if (next[g.id] === undefined) {
        next[g.id] = !!g.open;
        changed = true;
      }
    }
    if (changed) expanded = next;
  }
  $: groups = filterGallery(allGroups, query);
  $: searching = query.trim().length > 0;

  const cache = new Map<string, string>();
  $: $mathRegistryVersion, dir, cache.clear();

  function preview(item: GalleryItem, d: 'ltr' | 'rtl', _v: number): string {
    const key = `${d}|${item.preview}`;
    let html = cache.get(key);
    if (html === undefined) {
      html = sanitizeHtml(renderMath(item.preview, { display: false, dir: d }));
      cache.set(key, html);
    }
    return html;
  }

  function toggle(id: string) {
    expanded = { ...expanded, [id]: !expanded[id] };
  }
</script>

<div class="ar-gallery" dir="rtl">
  <input
    class="ar-search"
    type="search"
    bind:value={query}
    placeholder="ابحث: جيب، نهاية، ب مزدوجة، sin، \arBeh …"
    aria-label="البحث في الرموز العربية"
  />

  {#if groups.length === 0}
    <div class="ar-empty">لا توجد نتائج</div>
  {/if}

  {#each groups as group (group.id)}
    <div class="ar-group">
      <button class="ar-group-header" on:click={() => toggle(group.id)} aria-expanded={searching || !!expanded[group.id]}>
        <span class="chevron" class:open={searching || expanded[group.id]}>◂</span>
        <span>{group.label}</span>
        <span class="count">{group.items.length}</span>
      </button>
      {#if searching || expanded[group.id]}
        <div class="ar-grid" class:wide={group.id === 'templates'}>
          {#each group.items as item (item.id)}
            <button
              class="ar-item"
              title={`${item.label} — ${item.insert.trim()}`}
              on:click={() => onInsert(item.insert)}
            >
              <span class="ar-preview" dir="ltr">{@html preview(item, dir, $mathRegistryVersion)}</span>
              <span class="ar-label">{item.label}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .ar-gallery {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ar-search {
    width: 100%;
    box-sizing: border-box;
    background: #2a2a2a;
    border: 1px solid var(--border);
    color: var(--fg);
    padding: 6px 10px;
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.85rem;
  }
  .ar-search:focus {
    outline: none;
    border-color: var(--accent);
  }
  .ar-empty {
    color: var(--fg-muted);
    font-size: 0.8rem;
    text-align: center;
    padding: 1rem;
  }
  .ar-group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    background: none;
    border: none;
    color: var(--fg);
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    padding: 4px 2px;
    cursor: pointer;
    text-align: start;
  }
  .ar-group-header:hover {
    color: var(--accent);
  }
  .chevron {
    display: inline-block;
    transition: transform 0.15s;
    font-size: 0.7rem;
    color: var(--fg-muted);
  }
  .chevron.open {
    transform: rotate(-90deg);
  }
  .count {
    margin-inline-start: auto;
    font-size: 0.7rem;
    color: var(--fg-muted);
    font-weight: 400;
  }
  .ar-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
    gap: 4px;
    padding: 2px 0 6px;
  }
  .ar-grid.wide {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  .ar-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 52px;
    padding: 4px;
    background: #1a1a1a;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--fg);
    cursor: pointer;
    font-family: inherit;
    overflow: hidden;
  }
  .ar-item:hover,
  .ar-item:focus-visible {
    border-color: var(--accent);
    background: #222;
    outline: none;
  }
  .ar-preview {
    max-width: 100%;
    overflow: hidden;
    font-size: 1.05rem;
  }
  .ar-preview :global(.katex) {
    font-size: 1em;
  }
  .ar-label {
    font-size: 0.66rem;
    color: var(--fg-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
</style>
