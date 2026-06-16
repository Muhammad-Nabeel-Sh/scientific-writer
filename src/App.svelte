<script lang="ts">
  import { hierarchy, activeNoteId, noteContent } from "$lib/stores";
  import { initWorkspace, readNote } from "$lib/fs";
  import HierarchyTree from "./components/HierarchyTree.svelte";
  import Editor from "./components/Editor.svelte";
  import Preview from "./components/Preview.svelte";

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
  }

  $: if ($activeNoteId) {
    readNote($activeNoteId).then((c) => ($noteContent = c));
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
    <HierarchyTree />
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
