<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { hierarchy, activeNoteId } from '$lib/stores';
  import type { TreeNode } from '$lib/stores';
  import { invoke } from '@tauri-apps/api/core';
  import { createId } from '$lib/utils';
  import { saveHierarchy, getWorkspaceDir, setWorkspaceDir, pickWorkspaceDir, clearWorkspaceCache } from '$lib/fs';
  import { noteSaver } from '$lib/note-saver';
  import { pushHierarchySnapshot, recentWorkspaces, addRecentWorkspace, undoHierarchy, loadRecentWorkspaces, exportStatus } from '$lib/stores';
  import TreeItem from './TreeItem.svelte';
  import NewProjectDialog from './NewProjectDialog.svelte';
  import SearchDialog from './SearchDialog.svelte';
  import { noteContent, bibEntries, digitStyle, fontSettings, ligatureSettings } from '$lib/stores';
  import { renderMarkdown } from '$lib/markdown';
  import { renderWikiLinks } from '$lib/backlinks';
  import { sanitizeHtml } from '$lib/sanitize';

  const dispatch = createEventDispatcher<{ about: void; undo: void }>();

  $: nodes = $hierarchy;
  $: workspaces = $recentWorkspaces;

  onMount(() => {
    const handler = () => addNote();
    window.addEventListener('add-note', handler);
    return () => window.removeEventListener('add-note', handler);
  });
  let showNewProject = false;
  let showSearch = false;

  function save() {
    saveHierarchy([...$hierarchy]);
    pushHierarchySnapshot([...$hierarchy]);
  }

  function selectNote(id: string) {
    $activeNoteId = id;
  }

  function renameNode(node: TreeNode) {
    const newName = prompt('إعادة تسمية:', node.name);
    if (newName && newName.trim()) {
      node.name = newName.trim();
      $hierarchy = [...$hierarchy];
      save();
    }
  }

  function deleteNode(node: TreeNode) {
    if (!confirm(`حذف ${node.name}؟`)) return;
    const remove = (list: TreeNode[]): TreeNode[] =>
      list.filter((n) => {
        if (n.id === node.id) return false;
        if (n.children) n.children = remove(n.children);
        return true;
      });
    $hierarchy = remove([...$hierarchy]);
    // Don't let a pending autosave recreate a deleted note.
    const dropSaves = (n: TreeNode) => {
      noteSaver.discard(n.id);
      n.children?.forEach(dropSaves);
    };
    dropSaves(node);
    if ($activeNoteId === node.id) $activeNoteId = null;
    save();
  }

  function addNote(parentId?: string) {
    const id = createId();
    const newNote: TreeNode = { id, name: 'ملاحظة جديدة.md', type: 'note' };
    if (parentId) {
      const ins = (list: TreeNode[]): boolean => {
        for (const n of list) {
          if (n.id === parentId && n.type === 'folder') {
            n.children = [...(n.children || []), newNote];
            return true;
          }
          if (n.children && ins(n.children)) return true;
        }
        return false;
      };
      ins($hierarchy);
    } else {
      $hierarchy = [...$hierarchy, newNote];
    }
    $activeNoteId = id;
    $hierarchy = [...$hierarchy];
    save();
  }

  function addFolder() {
    const id = createId();
    const folder: TreeNode = { id, name: 'مجلد جديد', type: 'folder', expanded: true, children: [] };
    $hierarchy = [...$hierarchy, folder];
    save();
  }

  function openNewProject() {
    showNewProject = true;
  }

  function openSearch() {
    showSearch = true;
  }

  async function openWorkspace() {
    try {
      const path = await pickWorkspaceDir();
      if (path) await activateWorkspace(path);
    } catch (e) {
      console.error('[openWorkspace]', e);
    }
  }

  async function switchWorkspace(path: string) {
    try {
      await activateWorkspace(path);
    } catch (e) {
      console.error('[switchWorkspace]', e);
    }
  }

  async function activateWorkspace(path: string) {
    // Pending saves belong to the current workspace: write them before switching.
    await noteSaver.flush();
    await setWorkspaceDir(path); // throws if the user declines the native prompt
    addRecentWorkspace(path);
    window.dispatchEvent(new CustomEvent('reinit-workspace', { detail: { path } }));
  }

  function moveNode(nodeId: string, targetId: string, position: 'before' | 'after' | 'inside') {
    const findParent = (list: TreeNode[], id: string): { list: TreeNode[]; idx: number } | null => {
      for (let i = 0; i < list.length; i++) {
        if (list[i].id === id) return { list, idx: i };
        if (list[i].children) {
          const r = findParent(list[i].children!, id);
          if (r) return r;
        }
      }
      return null;
    };

    const src = findParent($hierarchy, nodeId);
    const dst = findParent($hierarchy, targetId);
    if (!src || !dst) return;
    const [node] = src.list.splice(src.idx, 1);
    if (position === 'inside') {
      const target = dst.list[dst.idx];
      if (target.type !== 'folder') return;
      target.children = [...(target.children || []), node];
    } else {
      const insertAt = position === 'before' ? dst.idx : dst.idx + 1;
      dst.list.splice(insertAt, 0, node);
    }
    $hierarchy = [...$hierarchy];
    save();
  }
  let showExportMenu = false;
  let exportMenuEl: HTMLDivElement;

  function toggleExportMenu(e: MouseEvent) {
    e.stopPropagation();
    showExportMenu = !showExportMenu;
  }

  function closeExportMenu() {
    showExportMenu = false;
  }

  function clickOutside(node: HTMLElement) {
    function handler(e: MouseEvent) {
      if (!node.contains(e.target as Node)) {
        closeExportMenu();
      }
    }
    document.addEventListener('click', handler);
    return {
      destroy() { document.removeEventListener('click', handler); }
    };
  }

  async function exportAs(name: string) {
    $exportStatus = { exporting: true, label: `جارٍ تصدير ${name}…` };
    try {
      const { getExporter, listExporters } = await import('$lib/publishing');
      const exporter = getExporter(name);
      if (!exporter) { $exportStatus = { exporting: false, label: '', error: `غير معروف: ${name}` }; return; }

      const { parseDocument } = await import('$lib/publishing/document');
      const doc = parseDocument($noteContent || '', $bibEntries);
      const result = await exporter.export(doc, $noteContent);

      let blob: Blob;
      if (result.content instanceof Uint8Array) {
        blob = new Blob([result.content], { type: result.mime });
      } else {
        blob = result.mime.startsWith('text/') || !result.mime.includes('officedocument')
          ? new Blob([result.content], { type: result.mime })
          : new Blob([Uint8Array.from(atob(result.content as string), c => c.charCodeAt(0))], { type: result.mime });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (doc.meta.title || 'document') + '.' + result.extension;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      $exportStatus = { exporting: false, label: 'تم التصدير بنجاح' };
      setTimeout(() => { $exportStatus = { exporting: false, label: '' }; }, 3000);
    } catch (err) {
      console.error('[export] error:', name, err);
      $exportStatus = { exporting: false, label: '', error: String(err) };
    }
  }

  async function exportPdf() {
    $exportStatus = { exporting: true, label: 'جارٍ تحضير PDF…' };
    try {
      let rendered = renderMarkdown($noteContent || '', $bibEntries, $digitStyle);
      rendered = sanitizeHtml(renderWikiLinks(rendered, $hierarchy));

      const f = $fontSettings, ly = $ligatureSettings;
      const fv = `"wght" ${f.weight}, "opsz" ${f.opticalSize}, "${f.family === 'Readex Pro' ? 'HEXP' : 'wdth'}" ${f.width}`;
      const lp: string[] = [];
      if (!ly.required) lp.push('"rlig" 0');
      if (!ly.standard) lp.push('"liga" 0');
      if (ly.discretionary) lp.push('"dlig" 1');
      const ls = lp.join(', ');
      const styleAttr = `font-family: ${f.family}, 'Amiri', 'Noto Sans Arabic', 'Readex Pro', serif; font-weight: ${f.weight}; font-size: ${f.fontSize}px; line-height: 1.8; font-variation-settings: ${fv}; font-feature-settings: ${ls || 'normal'};`;

      const wsDir = await getWorkspaceDir();
      if (wsDir) {
        const matches = [...rendered.matchAll(/src="([^"]+)"/g)];
        for (const m of matches) {
          let srcPath = m[1];
          if (srcPath.startsWith('http:') || srcPath.startsWith('https:') || srcPath.startsWith('data:')) continue;
          try {
            const absolutePath = srcPath.startsWith('/') || srcPath.match(/^[a-zA-Z]:\\/) 
              ? srcPath 
              : wsDir + '/' + srcPath;
            const bytes = await invoke<number[]>('read_binary_file', { path: absolutePath });
            const uint8 = Uint8Array.from(bytes);
            const ext = srcPath.split('.').pop()?.toLowerCase();
            const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : 'image/png';
            const blob = new Blob([uint8], { type: mime });
            const dataUrl = await new Promise<string>(resolve => {
              const r = new FileReader();
              r.onloadend = () => resolve(r.result as string);
              r.readAsDataURL(blob);
            });
            rendered = rendered.replace(m[0], `src="${dataUrl}"`);
          } catch (e) {
            console.error('[exportPdf] image failed:', srcPath, e);
          }
        }
      }

      // Remove lazy loading so images load immediately for print
      rendered = rendered.replace(/loading="lazy"/g, '');

      let css = '';
      for (const sheet of document.styleSheets) {
        try { for (const rule of sheet.cssRules) css += rule.cssText + '\n'; }
        catch { /* skip cross-origin */ }
      }

      // Fonts and KaTeX CSS are bundled with the app, so the print document
      // stays fully offline: its stylesheets are copied from the live app above.
      const html = `<!DOCTYPE html>
<html dir="rtl">
<head>
<meta charset="utf-8">
<style>
${css}
.preview code { background: #f0f0f0 !important; }
.preview pre { background: #f5f5f5 !important; }
.preview .academic-block { background: #f8f9fa !important; }
.preview blockquote { background: #f8f9fa !important; }
.preview .arabic-poem { background: #fefcf5 !important; }
.preview .classical-page { background: #fefcf5 !important; }
html, body { overflow: visible !important; height: auto !important; background: #fff !important; color: #000 !important; padding: 2rem; direction: rtl; }
.preview { margin: 0 auto; }
.preview-header { display: none; }
@page { margin: 2cm; }
@media print { body { padding: 0; } }
</style>
</head>
<body>
<div class="preview" style="${styleAttr}">${rendered}</div>
</body>
</html>`;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.zIndex = '-1';
      document.body.appendChild(iframe);
      iframe.contentDocument?.open();
      iframe.contentDocument?.write(html);
      iframe.contentDocument?.close();

      const doc = iframe.contentDocument;
      if (doc) {
        const imgs = Array.from(doc.images);
        Promise.all(imgs.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(r => { img.onload = r; img.onerror = r; });
        })).then(() => {
          setTimeout(() => {
            iframe.contentWindow?.print();
            setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 15000);
          }, 500);
        });
      } else {
        setTimeout(() => {
          iframe.contentWindow?.print();
          setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 15000);
        }, 1000);
      $exportStatus = { exporting: false, label: 'تم تصدير PDF' };
      setTimeout(() => { $exportStatus = { exporting: false, label: '' }; }, 3000);
      }
    } catch (err) {
      console.error('[exportPdf] error:', err);
      $exportStatus = { exporting: false, label: '', error: String(err) };
    }
  }
</script>

<div class="tree-container tree-scroll">
  <div class="tree-actions">
    <button class="tree-action-btn" title="ملاحظة جديدة" on:click={() => addNote()}>
      <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
    </button>
    <button class="tree-action-btn" title="مجلد جديد" on:click={addFolder}>
      <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" /></svg>
    </button>
    <button class="tree-action-btn search-btn" title="بحث" on:click={openSearch}>
      <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
    </button>
    <button class="tree-action-btn project-btn" title="فتح مساحة عمل" on:click={openWorkspace}>
      <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" /></svg>
    </button>
    <button class="tree-action-btn" title="مشروع جديد" on:click={openNewProject}>
      <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /><polyline points="20 12 20 22 4 22 4 12" /><polyline points="12 2 12 8 20 8 12 2" /><line x1="8" y1="16" x2="16" y2="16" /></svg>
    </button>
    <button class="tree-action-btn" title="تراجع عن التعديل" on:click={() => { undoHierarchy(); dispatch('undo'); }}>
      <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" /></svg>
    </button>
    <button class="tree-action-btn" title="حول" on:click={() => dispatch('about')}>
      <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
    </button>
    <div class="export-wrapper" bind:this={exportMenuEl} use:clickOutside>
      <button class="tree-action-btn" title="تصدير" on:click|stopPropagation={toggleExportMenu}>
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
      </button>
      {#if showExportMenu}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="export-dropdown" on:click|stopPropagation>
          <button class="export-item" on:click={() => { closeExportMenu(); exportAs('docx'); }}>DOCX</button>
          <button class="export-item" on:click={() => { closeExportMenu(); exportAs('markdown'); }}>MD</button>
          <button class="export-item" on:click={() => { closeExportMenu(); exportAs('latex'); }}>LaTeX</button>
          <button class="export-item" on:click={() => { closeExportMenu(); exportAs('typst'); }}>Typst</button>
          <button class="export-item" on:click={() => { closeExportMenu(); exportPdf(); }}>PDF</button>
        </div>
      {/if}
    </div>
  </div>
  {#if workspaces.length > 0}
    <div class="workspace-list">
      <span class="workspace-label">مساحات العمل الأخيرة</span>
      {#each workspaces as ws}
        <button class="workspace-item" on:click={() => switchWorkspace(ws.path)} title={ws.path}>
          <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
          <span>{ws.label}</span>
        </button>
      {/each}
    </div>
  {/if}
  {#each nodes as node (node.id)}
    <TreeItem {node} {selectNote} {renameNode} {deleteNode} {addNote} {moveNode} />
  {:else}
    <div class="empty-msg">لا توجد ملاحظات</div>
  {/each}
</div>

<NewProjectDialog bind:show={showNewProject} />
<SearchDialog bind:show={showSearch} />

<style>
  .tree-container { display: flex; flex-direction: column; gap: 2px; }
  .tree-container.tree-scroll { overflow-y: auto; overflow-x: hidden; flex: 1; }
  .tree-actions { display: flex; gap: 4px; margin-bottom: 8px; }
  .tree-action-btn {
    background: none; border: 1px solid var(--border); color: var(--fg-muted);
    cursor: pointer; padding: 4px 8px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s, color 0.15s;
  }
  .tree-action-btn:hover { background: var(--bg-hover); color: var(--fg); }
  .tree-action-btn svg { width: 18px; height: 18px; }
  .search-btn { margin-inline-end: auto; }
  .project-btn { margin-inline-start: auto; }
  .empty-msg { color: var(--fg-muted); font-size: 0.9rem; padding: 1rem; text-align: center; }
  .workspace-list {
    display: flex; flex-direction: column; gap: 2px;
    padding: 6px 0; border-top: 1px solid var(--border); margin-top: 8px;
  }
  .workspace-label {
    font-size: 0.7rem; color: var(--fg-muted); padding: 2px 10px;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .workspace-item {
    display: flex; align-items: center; gap: 6px;
    background: none; border: none; color: var(--fg-muted);
    cursor: pointer; padding: 5px 10px; border-radius: 4px;
    font-size: 0.8rem; font-family: inherit;
    transition: background 0.15s, color 0.15s; text-align: start;
  }
  .workspace-item:hover { background: var(--bg-hover); color: var(--fg); }
  .workspace-item svg { width: 14px; height: 14px; flex-shrink: 0; }
  .export-wrapper { position: relative; }
  .export-dropdown {
    position: absolute; top: 100%; left: 0; z-index: 50;
    background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
    padding: 4px; display: flex; flex-direction: column; gap: 2px;
    min-width: 90px; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }
  .export-item {
    background: none; border: none; color: var(--fg); cursor: pointer;
    padding: 6px 12px; border-radius: 4px; text-align: start;
    font-size: 0.85rem; font-family: inherit;
    transition: background 0.15s;
  }
  .export-item:hover { background: var(--bg-hover); }
</style>
