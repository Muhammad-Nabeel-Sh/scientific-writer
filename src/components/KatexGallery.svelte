<script lang="ts">
  import {
    renderMath,
    getSymbols,
    searchSymbols,
    mathRegistryVersion,
    SYMBOL_CATEGORIES,
    type MathSymbol,
    type SymbolCategory,
  } from '$lib/math';
  import { KATEX_CATALOG } from '$lib/math/katex-catalog';
  import { normalizeArabic } from '$lib/search';
  import { sanitizeHtml } from '$lib/sanitize';

  export let onInsert: (latex: string) => void;

  interface GalleryItem {
    latex: string;
    preview: string;
    code: string;
  }

  interface GalleryCategory {
    name: string;
    label: string;
    items: GalleryItem[];
  }

  const SYMBOL_CATEGORY_LABELS: Record<SymbolCategory, string> = {
    'arabic-letter': 'الحروف العربية الرياضية',
    'arabic-function': 'الدوال العربية',
    operator: 'العوامل',
    relation: 'العلاقات',
    arrow: 'الأسهم',
    unit: 'الوحدات',
    misc: 'رموز أخرى',
  };

  let query = '';
  let expanded: Record<string, boolean> = {};
  let normalizedQuery = '';
  let catalog: GalleryCategory[] = KATEX_CATALOG;
  let registry: GalleryCategory[] = [];
  let categories: GalleryCategory[] = [];
  let searching = false;

  $: normalizedQuery = normalizeArabic(query.trim().toLowerCase().replace(/^\\/, ''));
  $: catalog = filterCatalog(KATEX_CATALOG, normalizedQuery);
  $: $mathRegistryVersion, (registry = registryCategories(query));
  $: categories = [...catalog, ...registry];
  $: searching = normalizedQuery.length > 0;

  function symbolItem(sym: MathSymbol): GalleryItem {
    const args = '{س}'.repeat(sym.arity ?? 0);
    const call = `\\${sym.name}${args}`;
    return { latex: call, preview: call, code: `\\${sym.name}` };
  }

  function registryCategories(term: string): GalleryCategory[] {
    const symbols = term.trim() ? searchSymbols(term) : getSymbols();
    return SYMBOL_CATEGORIES.map((category) => ({
      name: `reg-${category}`,
      label: SYMBOL_CATEGORY_LABELS[category],
      items: symbols.filter((s) => s.category === category).map(symbolItem),
    })).filter((c) => c.items.length > 0);
  }

  function filterCatalog(cats: GalleryCategory[], q: string): GalleryCategory[] {
    if (!q) return cats;
    return cats
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) =>
          [cat.label, item.latex, item.code, item.preview].some((s) =>
            normalizeArabic(s.toLowerCase()).includes(q),
          ),
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }

  const cache = new Map<string, string>();
  $: $mathRegistryVersion, cache.clear();

  function preview(item: GalleryItem, _version: number): string {
    let html = cache.get(item.preview);
    if (html === undefined) {
      html = sanitizeHtml(renderMath(item.preview, { display: true }));
      cache.set(item.preview, html);
    }
    return html;
  }

  function toggle(name: string) {
    expanded = { ...expanded, [name]: !expanded[name] };
  }
</script>

<div class="katex-gallery">
  <input
    class="kg-search"
    type="search"
    bind:value={query}
    placeholder="ابحث: كسر، جيب، sin، \jaa …"
    aria-label="البحث في رموز LaTeX"
  />

  {#if categories.length === 0}
    <div class="kg-empty">لا توجد نتائج</div>
  {/if}

  {#each categories as cat (cat.name)}
    <div class="kg-category">
      <button class="kg-header" on:click={() => toggle(cat.name)} aria-expanded={searching || !!expanded[cat.name]}>
        <svg
          class="kg-chevron"
          class:rotated={searching || expanded[cat.name]}
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
        <span class="kg-count">{cat.items.length}</span>
      </button>
      {#if searching || expanded[cat.name]}
        <div class="kg-items">
          {#each cat.items as item (item.latex + '|' + item.code)}
            <button class="kg-item" on:click={() => onInsert(item.latex)}>
              <div class="kg-preview" dir="ltr">
                {@html preview(item, $mathRegistryVersion)}
              </div>
              <div class="kg-code">
                <code>{item.code}</code>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .katex-gallery {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .kg-search {
    width: 100%;
    box-sizing: border-box;
    background: #2a2a2a;
    border: 1px solid var(--border);
    color: var(--fg);
    padding: 6px 10px;
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.85rem;
    margin-bottom: 5px;
  }
  .kg-search:focus {
    outline: none;
    border-color: var(--accent);
  }
  .kg-empty {
    color: var(--fg-muted);
    font-size: 0.8rem;
    text-align: center;
    padding: 1rem;
  }
  .kg-category {
    display: flex;
    flex-direction: column;
  }
  .kg-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    background: none;
    border: none;
    color: var(--fg);
    cursor: pointer;
    padding: 6px 8px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.82rem;
    text-align: start;
    transition: background 0.15s;
  }
  .kg-header:hover {
    background: var(--bg-hover);
  }
  .kg-chevron {
    width: 12px;
    height: 12px;
    transition: transform 0.2s;
    flex-shrink: 0;
  }
  .kg-chevron.rotated {
    transform: rotate(90deg);
  }
  .kg-count {
    margin-inline-start: auto;
    font-size: 0.7rem;
    color: var(--fg-muted);
    background: #2a2a2a;
    padding: 0 6px;
    border-radius: 8px;
    line-height: 1.5;
  }
  .kg-items {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 4px;
    padding: 4px 8px 8px 20px;
  }
  .kg-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    background: #2a2a2a;
    border: 1px solid var(--border);
    color: var(--fg);
    cursor: pointer;
    padding: 6px 4px;
    border-radius: 6px;
    transition: background 0.15s, border-color 0.15s, transform 0.1s;
  }
  .kg-item:hover {
    background: #3a3a3a;
    border-color: var(--accent);
    transform: translateY(-1px);
  }
  .kg-item:active {
    transform: translateY(0);
  }
  .kg-preview {
    min-height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    overflow-x: auto;
  }
  .kg-preview :global(.katex-display) {
    margin: 0.15em 0;
    font-size: 0.95rem;
  }
  .kg-preview :global(.katex) {
    font-size: 0.95rem;
  }
  .kg-code {
    width: 100%;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kg-code code {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--fg-muted);
    background: none;
    padding: 0;
    white-space: nowrap;
    direction: ltr;
    unicode-bidi: isolate;
  }
</style>
