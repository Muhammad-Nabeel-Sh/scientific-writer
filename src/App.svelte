<script lang="ts">
  import { hierarchy, activeNoteId, noteContent, bibEntries, backlinksIndex } from "$lib/stores";
  import { initWorkspace, readNote, ensureBibliography } from "$lib/fs";
  import { parseBibTeX } from "$lib/bibliography";
  import { buildBacklinksIndex, updateBacklinksForNote } from "$lib/backlinks";
  import HierarchyTree from "./components/HierarchyTree.svelte";
  import Outline from "./components/Outline.svelte";
  import BacklinksPanel from "./components/BacklinksPanel.svelte";
  import Stats from "./components/Stats.svelte";
  import Editor from "./components/Editor.svelte";
  import Preview from "./components/Preview.svelte";
  import SplashScreen from "./components/SplashScreen.svelte";

  let showSplash = true;
  let leftWidth = 280;
  let rightWidth = 400;
  let isDragging = false;
  let dragTarget = "";
  let startX = 0;
  let startWidth = 0;

  function setProportions() {
    const w = window.innerWidth - 12;
    leftWidth = w * 0.2;
    rightWidth = w * 0.4;
  }

  async function init() {
    setProportions();
    const data = await initWorkspace();
    $hierarchy = data;
    const bibContent = await ensureBibliography();
    $bibEntries = parseBibTeX(bibContent);
    $backlinksIndex = await buildBacklinksIndex(data);
  }

  $: if ($activeNoteId && $activeNoteId !== '__references__') {
    readNote($activeNoteId).then((c) => ($noteContent = c));
  }

  let prevContent = '';
  $: if ($noteContent !== prevContent && $activeNoteId && $activeNoteId !== '__references__') {
    prevContent = $noteContent;
    updateBacklinksForNote($backlinksIndex, $activeNoteId, $noteContent, $hierarchy);
    $backlinksIndex = $backlinksIndex; // trigger reactivity
  }

  function openReferences() {
    $activeNoteId = '__references__';
    ensureBibliography().then((c) => {
      $noteContent = c;
    });
  }

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
</script>

<div class="app-layout">
  <aside class="panel left" style="width: {leftWidth}px;">
    <HierarchyTree on:about={() => (showSplash = true)} />
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
    </div>
    <Outline />
    <BacklinksPanel />
    <Stats />
  </aside>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="handle" on:mousedown={(e) => startDrag(e, "left")}></div>

  <main class="panel center">
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