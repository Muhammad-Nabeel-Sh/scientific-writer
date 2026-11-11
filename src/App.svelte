<script lang="ts">
  import {
    hierarchy, activeNoteId, noteContent, bibEntries, backlinksIndex,
    openTabs, activeTabId, openNoteTab, closeNoteTab, updateTabContent, renameTab,
    openTabList, pushHierarchySnapshot, undoHierarchy, redoHierarchy,
    recentWorkspaces, loadRecentWorkspaces, addRecentWorkspace,
    lastBackupTime, BACKUP_INTERVAL, exportStatus,
    loadKeybindings, keybindings, highlightTheme, noteLoading,
  } from "$lib/stores";
  import { noteSaver, REFERENCES_ID } from "$lib/note-saver";
  import { installExternalLinkHandler } from "$lib/external-links";
  import { onMount } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { isTauri } from "@tauri-apps/api/core";
  import { initWorkspace, readNote, ensureBibliography, backupNote, clearWorkspaceCache } from "$lib/fs";
  import { parseBibTeX } from "$lib/bibliography";
  import { buildBacklinksIndex, updateBacklinksForNote } from "$lib/backlinks";
  import { registerExporter } from "$lib/publishing";
  import { DocxExporter } from "$lib/publishing/docx-exporter";
  import { MarkdownExporter } from "$lib/publishing/markdown-exporter";
  import { LatexExporter } from "$lib/publishing/latex-exporter";
  import { TypstExporter } from "$lib/publishing/typst-exporter";
  import HierarchyTree from "./components/HierarchyTree.svelte";
  import Outline from "./components/Outline.svelte";
  import BacklinksPanel from "./components/BacklinksPanel.svelte";
  import Stats from "./components/Stats.svelte";
  import Editor from "./components/Editor.svelte";
  import Preview from "./components/Preview.svelte";
  import SplashScreen from "./components/SplashScreen.svelte";
  import QuickOpen from "./components/QuickOpen.svelte";
  import Tabs from "./components/Tabs.svelte";
  import AssetsPanel from "./components/AssetsPanel.svelte";
  import { reloadWorkspaceSymbols } from "$lib/math-workspace";

  let showSplash = true;
  let leftWidth = 280;
  let rightWidth = 400;
  let isDragging = false;
  let dragTarget = "";
  let startX = 0;
  let startWidth = 0;
  let showQuickOpen = false;
  let showAssets = false;

  // `npm run dev` serves the frontend to a normal browser, where the Tauri IPC
  // bridge does not exist. Detect it so the UI degrades gracefully instead of
  // throwing "cannot read invoke/metadata" on startup.
  const isTauriRuntime = typeof window !== "undefined" && isTauri();

  function setProportions() {
    const w = window.innerWidth - 12;
    leftWidth = w * 0.2;
    rightWidth = w * 0.4;
  }

  async function init(fromWorkspace?: string) {
    setProportions();
    loadRecentWorkspaces();
    loadKeybindings();

    if (!isTauriRuntime) {
      console.warn(
        "[app] Tauri runtime not detected. Run `npm run tauri dev` to open the desktop app.",
      );
      showSplash = false;
      return;
    }

    const data = await initWorkspace(fromWorkspace);
    $hierarchy = data;
    pushHierarchySnapshot(data);
    const symbolProblems = await reloadWorkspaceSymbols();
    if (symbolProblems.length > 0) {
      console.warn('[math] math-symbols.json:', symbolProblems);
      $exportStatus = { exporting: false, label: '', error: `مشكلات في الرموز المخصصة: ${symbolProblems[0]}` };
      setTimeout(() => ($exportStatus = { exporting: false, label: '' }), 8000);
    }
    const bibContent = await ensureBibliography();
    $bibEntries = parseBibTeX(bibContent);
    $backlinksIndex = await buildBacklinksIndex(data);
    registerExporter(new DocxExporter());
    registerExporter(new MarkdownExporter());
    registerExporter(new LatexExporter());
    registerExporter(new TypstExporter());
    startAutoRecovery();
  }

  /* ── Handle workspace reinit without page reload ── */
  function handleReinit(e: CustomEvent<{ path: string }>) {
    // Clear all stores
    $hierarchy = [];
    $activeNoteId = null;
    $noteContent = '';
    $bibEntries = [];
    $backlinksIndex = new Map();
    $openTabs = new Map();
    $activeTabId = null;
    prevContent = '';

    import('$lib/fs').then(mod => {
      mod.clearWorkspaceCache();
    }).then(() => {
      init(e.detail.path);
    });
  }

  /* ── Tab integration: open note in tab on selection ──
     Runs only when the active note id changes (not on hierarchy edits),
     prefers the open tab's in-memory text over disk, and writes pending
     saves first so the disk copy is current. The editor is read-only while
     loading so keystrokes cannot land in the wrong note. */
  $: loadActiveNote($activeNoteId);

  let loadSeq = 0;
  async function loadActiveNote(id: string | null) {
    const seq = ++loadSeq;
    if (!id || id === REFERENCES_ID) return;
    const tab = $openTabs.get(id);
    if (tab) {
      prevContent = tab.content;
      $noteContent = tab.content;
      $activeTabId = id;
      return;
    }
    $noteLoading = true;
    try {
      await noteSaver.flush();
      const c = await readNote(id);
      if (seq !== loadSeq) return; // user already moved on
      const node = findNode($hierarchy, id);
      const name = node ? node.name.replace(/\.md$/i, '') : id;
      openNoteTab(id, name, c);
      prevContent = c;
      $noteContent = c;
    } finally {
      if (seq === loadSeq) $noteLoading = false;
    }
  }

  function findNode(nodes: any[], id: string): any {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) { const f = findNode(n.children, id); if (f) return f; }
    }
    return null;
  }

  /* ── Sync editor content back to tab store ── */
  let prevContent = '';
  $: if ($noteContent !== prevContent && $activeNoteId && $activeNoteId !== '__references__') {
    prevContent = $noteContent;
    updateTabContent($activeNoteId, $noteContent);
    updateBacklinksForNote($backlinksIndex, $activeNoteId, $noteContent, $hierarchy);
    $backlinksIndex = $backlinksIndex;
  }

  /* ── Tab navigation ── */
  function switchToTab(id: string) {
    $activeNoteId = id;
    const tab = $openTabs.get(id);
    if (tab) { $noteContent = tab.content; }
  }

  function onCloseTab(id: string) {
    if (id === $activeNoteId) $activeNoteId = null;
    closeNoteTab(id);
  }

  /* ── Keyboard shortcuts ── */
  function handleGlobalKeydown(e: KeyboardEvent) {
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (ctrl && key === 'p') {
      e.preventDefault();
      showQuickOpen = true;
      return;
    }
    if (ctrl && key === 'w') {
      e.preventDefault();
      if ($activeTabId) onCloseTab($activeTabId);
      return;
    }
    if (ctrl && key === 'n') {
      e.preventDefault();
      // Dispatched to HierarchyTree via a custom event
      window.dispatchEvent(new CustomEvent('add-note'));
      return;
    }
    if (ctrl && key === 'z' && e.shiftKey) {
      e.preventDefault();
      redoHierarchy();
      return;
    }
    if (ctrl && key === 'z' && !e.shiftKey) {
      // Let Editor handle its own undo; we handle hierarchy undo if no editor focus
      if (document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        undoHierarchy();
      }
      return;
    }
  }

  /* ── Auto-recovery (periodic backup) ── */
  let recoveryTimer: ReturnType<typeof setInterval>;
  function startAutoRecovery() {
    recoveryTimer = setInterval(async () => {
      if ($activeNoteId && $activeNoteId !== '__references__' && $noteContent.trim()) {
        await backupNote($activeNoteId, $noteContent);
      }
    }, BACKUP_INTERVAL);
  }

  /* ── References editor ── */
  async function openReferences() {
    $noteLoading = true;
    try {
      await noteSaver.flush();
      $activeNoteId = REFERENCES_ID;
      $noteContent = await ensureBibliography();
    } finally {
      $noteLoading = false;
    }
  }

  onMount(() => {
    const uninstallLinks = installExternalLinkHandler();
    let unlisten: (() => void) | undefined;
    let disposed = false;
    let closing = false;

    // Flush the debounced save queue before the window actually closes, so
    // keystrokes from the last 500 ms are never lost. The first close request
    // is cancelled; after flushing we close again and let the second pass
    // through (the flag prevents an infinite loop).
    if (isTauriRuntime) {
      getCurrentWindow()
        .onCloseRequested(async (event) => {
          if (closing) return;
          closing = true;
          event.preventDefault();
          try {
            await noteSaver.flush();
            await getCurrentWindow().close();
          } catch (e) {
            closing = false;
            console.error("[window] close after flush failed:", e);
          }
        })
        .then((fn) => {
          if (disposed) fn();
          else unlisten = fn;
        })
        .catch((e) => console.error("[window] close handler:", e));
    }

    return () => {
      disposed = true;
      unlisten?.();
      uninstallLinks();
    };
  });

  function startDrag(e: MouseEvent, target: string) {
    isDragging = true;
    dragTarget = target;
    startX = e.clientX;
    startWidth = target === "left" ? leftWidth : rightWidth;
    document.body.style.cursor = "col-resize";
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", stopDrag);
  }

  function onDrag(e: MouseEvent) {
    if (!isDragging) return;
    const delta = e.clientX - startX;
    if (dragTarget === "left")
      leftWidth = Math.max(150, Math.min(600, startWidth + delta));
    else rightWidth = Math.max(200, Math.min(800, startWidth - delta));
  }

  function stopDrag() {
    isDragging = false;
    document.body.style.cursor = "";
    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("mouseup", stopDrag);
  }

  init();

  $: {
    if (typeof window !== 'undefined') {
      window.addEventListener('reinit-workspace', handleReinit as EventListener);
    }
  }

  const hlThemeModules: Record<string, { default: string }> = import.meta.glob(
    '/node_modules/highlight.js/styles/*.css',
    { eager: true, query: '?raw' },
  );

  let hlThemeStyleEl: HTMLStyleElement | null = null;

  $: if ($highlightTheme) {
    if (hlThemeStyleEl) hlThemeStyleEl.remove();
    const key = Object.keys(hlThemeModules).find(k => k.endsWith($highlightTheme + '.css'));
    if (key) {
      hlThemeStyleEl = document.createElement('style');
      hlThemeStyleEl.textContent = hlThemeModules[key].default;
      document.head.appendChild(hlThemeStyleEl);
    }
  }
</script>

<svelte:window on:keydown={handleGlobalKeydown} />

<div class="app-layout">
  <aside class="panel left" style="width: {leftWidth}px;">
    <HierarchyTree on:about={() => (showSplash = true)} on:undo={undoHierarchy} />
    <div class="refs-row">
      <button
        class="refs-btn"
        class:active={$activeNoteId === '__references__'}
        on:click={openReferences}
      >
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <span>المراجع</span>
      </button>
      <button class="refs-btn" title="إدارة الملفات" on:click={() => (showAssets = !showAssets)}>
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
        </svg>
        <span>الملفات</span>
      </button>
    </div>
    <Outline />
    <BacklinksPanel />
    <Stats />
  </aside>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="handle" on:mousedown={(e) => startDrag(e, "left")}></div>

  <main class="panel center">
    {#if !isTauriRuntime}
      <div
        class="runtime-warning"
        dir="rtl"
        style="padding:8px 12px;background:#3a2a12;border-bottom:1px solid #5a4020;color:#f0c674;font-size:0.85rem;text-align:center;"
      >
        هذا عرض للمتصفح فقط. شغّل <code style="direction:ltr;unicode-bidi:isolate;">npm run tauri dev</code> لفتح التطبيق المكتبي وتفعيل الملفات والقواميس.
      </div>
    {/if}
    <Tabs {switchToTab} {onCloseTab} />
    <Editor />
  </main>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="handle" on:mousedown={(e) => startDrag(e, "right")}></div>

  <aside class="panel right" style="width: {rightWidth}px;">
    <Preview />
  </aside>
</div>

{#if showSplash}
  <SplashScreen on:close={() => (showSplash = false)} />
{/if}

{#if showQuickOpen}
  <QuickOpen on:close={() => (showQuickOpen = false)} on:navigate={(e) => { switchToTab(e.detail.id); }} />
{/if}

{#if showAssets}
  <AssetsPanel on:close={() => (showAssets = false)} />
{/if}

{#if $exportStatus.exporting || $exportStatus.label}
  <div class="export-toast" class:error={!!$exportStatus.error} dir="rtl">
    {#if $exportStatus.exporting}
      <span class="spinner"></span>
    {/if}
    <span>{$exportStatus.label || $exportStatus.error || ''}</span>
  </div>
{/if}