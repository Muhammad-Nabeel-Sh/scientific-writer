<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { getWorkspaceDir, listAssets, deleteAssetFile, copyFile } from '$lib/fs';
  import { invoke } from '@tauri-apps/api/core';

  const dispatch = createEventDispatcher<{ close: void }>();

  let assets: { name: string; url: string; size: number }[] = [];
  let loading = true;
  let selected: string | null = null;
  let previewUrl: string | null = null;

  onMount(async () => {
    try {
      const dir = await getWorkspaceDir();
      const names = await listAssets(dir);
      assets = await Promise.all(names.map(async (name) => {
        try {
          const bytes = await invoke<number[]>('read_binary_file', { path: `${dir}/assets/${name}` });
          const ext = name.split('.').pop()?.toLowerCase();
          const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '');
          if (isImage) {
            const uint8 = Uint8Array.from(bytes);
            const mimes: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' };
            const blob = new Blob([uint8], { type: mimes[ext!] || 'image/png' });
            const url = URL.createObjectURL(blob);
            return { name, url, size: bytes.length };
          }
          return { name, url: '', size: bytes.length };
        } catch {
          return { name, url: '', size: 0 };
        }
      }));
    } catch (e) {
      console.error('[AssetsPanel]', e);
    }
    loading = false;
  });

  function select(name: string) {
    selected = selected === name ? null : name;
    const asset = assets.find(a => a.name === name);
    previewUrl = asset?.url || null;
  }

  async function doDelete(name: string) {
    if (!confirm(`حذف "${name}"؟`)) return;
    try {
      await deleteAssetFile(name);
      assets = assets.filter(a => a.name !== name);
      if (selected === name) { selected = null; previewUrl = null; }
    } catch (e) {
      alert('فشل الحذف: ' + e);
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function insertMarkdown(name: string) {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '')) {
      const md = `![${name}](assets/${name})`;
      // Insert into editor via clipboard-like approach
      navigator.clipboard.writeText(md).then(() => {
        /* user can paste */
      });
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" on:click={() => dispatch('close')} on:keydown role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div class="panel" on:click|stopPropagation on:keydown role="dialog" tabindex="-1" dir="rtl">
    <div class="header">
      <h3>الملفات المرفقة</h3>
      <button class="close-btn" on:click={() => dispatch('close')}>✕</button>
    </div>

    <div class="content">
      {#if loading}
        <div class="loading">جارٍ التحميل…</div>
      {:else if assets.length === 0}
        <div class="empty">
          <p>لا توجد ملفات مرفقة</p>
          <p class="hint">يمكنك إرفاق الصور من شريط أدوات المحرر</p>
        </div>
      {:else}
        <div class="grid">
          {#each assets as asset}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="asset-card"
              class:selected={selected === asset.name}
              on:click={() => select(asset.name)}
              on:keydown
              role="presentation"
            >
              {#if asset.url}
                <img src={asset.url} alt={asset.name} class="thumb" loading="lazy" />
              {:else}
                <div class="file-icon">
                  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
              {/if}
              <span class="asset-name">{asset.name}</span>
              <span class="asset-size">{formatSize(asset.size)}</span>
              {#if selected === asset.name}
                <div class="asset-actions">
                  {#if asset.url}
                    <button class="act-btn" on:click|stopPropagation={() => insertMarkdown(asset.name)} title="نسخ رابط الصورة">
                      <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
                    </button>
                  {/if}
                  <button class="act-btn danger" on:click|stopPropagation={() => doDelete(asset.name)} title="حذف">
                    <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    {#if previewUrl}
      <div class="preview-area">
        <img src={previewUrl} alt="معاينة" class="preview-img" />
      </div>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex; align-items: center; justify-content: center;
    z-index: 200;
  }
  .panel {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    width: min(90vw, 560px);
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }
  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.75rem 1rem; border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .header h3 { margin: 0; font-size: 1rem; }
  .close-btn {
    background: none; border: none; color: var(--fg-muted);
    cursor: pointer; font-size: 1.2rem; padding: 4px;
  }
  .close-btn:hover { color: var(--fg); }
  .content { flex: 1; overflow-y: auto; padding: 0.75rem 1rem; }
  .loading, .empty { text-align: center; padding: 2rem; color: var(--fg-muted); }
  .hint { font-size: 0.8rem; margin-top: 0.5rem; color: var(--fg-muted); }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 8px;
  }
  .asset-card {
    display: flex; flex-direction: column;
    align-items: center; gap: 4px;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    position: relative;
  }
  .asset-card:hover { border-color: var(--accent); background: #222; }
  .asset-card.selected { border-color: var(--accent); background: #2a2030; }
  .thumb {
    width: 100%; height: 80px;
    object-fit: cover;
    border-radius: 4px;
  }
  .file-icon svg { width: 40px; height: 40px; color: var(--fg-muted); }
  .asset-name {
    font-size: 0.72rem; text-align: center;
    overflow: hidden; text-overflow: ellipsis; max-width: 100%;
    white-space: nowrap;
  }
  .asset-size { font-size: 0.65rem; color: var(--fg-muted); }
  .asset-actions {
    display: flex; gap: 4px; margin-top: 4px;
  }
  .act-btn {
    background: #2a2a2a; border: none;
    cursor: pointer; padding: 2px 6px;
    border-radius: 4px; font-size: 0.8rem;
  }
  .act-btn:hover { background: #444; }
  .act-btn.danger:hover { background: #4a1a1a; }
  .preview-area {
    border-top: 1px solid var(--border);
    padding: 0.75rem 1rem;
    max-height: 200px;
    overflow: hidden;
    display: flex;
    justify-content: center;
    background: #111;
    border-radius: 0 0 10px 10px;
  }
  .preview-img {
    max-width: 100%;
    max-height: 180px;
    object-fit: contain;
  }
</style>
