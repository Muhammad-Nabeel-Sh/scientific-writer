<script lang="ts">
  import {
    noteContent,
    activeNoteId,
    editorRef,
    activeHeadingId,
    outlineItems,
    bibEntries,
    hierarchy,
  } from "$lib/stores";
  import { get } from "svelte/store";
  import { writeNote, writeBibliography, getWorkspaceDir } from "$lib/fs";
  import { parseBibTeX } from "$lib/bibliography";
  import { invoke } from "@tauri-apps/api/core";
  import { debounce } from "$lib/utils";
  import QuranDialog from "./QuranDialog.svelte";
  import HadithDialog from "./HadithDialog.svelte";
  import CitationDialog from "./CitationDialog.svelte";
  import EquationDialog from "./EquationDialog.svelte";
  import EnvironmentDialog from "./EnvironmentDialog.svelte";
  import DiacriticDialog from "./DiacriticDialog.svelte";
  import TafqitDialog from "./TafqitDialog.svelte";
  import DateDialog from "./DateDialog.svelte";
  import DictionaryDialog from "./DictionaryDialog.svelte";

  let textareaRef: HTMLTextAreaElement;
  let saveTimeout: ReturnType<typeof setTimeout>;
  let fileInput: HTMLInputElement;

  let showHeadingMenu = false;
  let headingBtnRef: HTMLButtonElement;
  let headingDropdownStyle = "";
  let showTableDialog = false;
  let showQuranDialog = false;
  let showHadithDialog = false;
  let showCitationDialog = false;
  let showEquationDialog = false;
  let showEnvironmentDialog = false;
  let showDiacriticDialog = false;
  let showTafqitDialog = false;
  let showDateDialog = false;
  let showDictionaryDialog = false;
  let showWikiLinkDialog = false;
  let wikiLinkSearch = "";
  let tableRows = 3;
  let tableCols = 4;
  let tableLang: "arabic" | "english" = "arabic";
  let tableAlign: "left" | "center" | "right" = "left";

  $: flatNotes = (function collect(
    nodes: any[],
  ): { id: string; name: string }[] {
    const result: { id: string; name: string }[] = [];
    for (const node of nodes) {
      if (node.type === "note")
        result.push({ id: node.id, name: node.name.replace(/\.md$/i, "") });
      if (node.children) result.push(...collect(node.children));
    }
    return result;
  })($hierarchy);

  $: filteredNotes = wikiLinkSearch
    ? flatNotes.filter((n) =>
        n.name.toLowerCase().includes(wikiLinkSearch.toLowerCase()),
      )
    : flatNotes;

  let history: string[] = [""];
  let historyIndex = 0;
  let ignoreNextInput = false;

  $: content = $noteContent;

  const debouncedSave = debounce(async () => {
    if (!$activeNoteId || !content.trim()) return;
    try {
      if ($activeNoteId === "__references__") {
        await writeBibliography(content);
        $bibEntries = parseBibTeX(content);
      } else {
        await writeNote($activeNoteId, content);
      }
    } catch {
      /* ignore */
    }
  }, 500);

  function pushHistory() {
    const val = textareaRef?.value;
    if (val == null) return;
    if (history[historyIndex] === val) return;
    history = history.slice(0, historyIndex + 1);
    history.push(val);
    if (history.length > 200) history.shift();
    historyIndex = history.length - 1;
  }

  function setValue(val: string) {
    ignoreNextInput = true;
    textareaRef.value = val;
    textareaRef.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function undo() {
    if (historyIndex <= 0) return;
    historyIndex--;
    setValue(history[historyIndex]);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    setValue(history[historyIndex]);
  }

  function handleInput(e: Event) {
    if (ignoreNextInput) {
      ignoreNextInput = false;
      return;
    }
    pushHistory();
    const val = (e.target as HTMLTextAreaElement).value;
    $noteContent = val;
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(debouncedSave, 300);
  }

  $: if (textareaRef) {
    textareaRef.focus();
    $editorRef = textareaRef;
  }

  function onEditorScroll() {
    if (!textareaRef) return;
    const lineHeight =
      parseFloat(getComputedStyle(textareaRef).lineHeight) || 20;
    const currentLine = Math.floor(textareaRef.scrollTop / lineHeight);
    const items = get(outlineItems);
    let nearest: string | null = null;
    for (const item of items) {
      if (item.lineIndex <= currentLine) {
        nearest = item.id;
      } else {
        break;
      }
    }
    $activeHeadingId = nearest;
  }

  function insertAtCursor(text: string) {
    pushHistory();
    const ta = textareaRef;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    ta.value = ta.value.substring(0, start) + text + ta.value.substring(end);
    const pos = start + text.length;
    ta.selectionStart = ta.selectionEnd = pos;
    ta.focus();
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function appendText(text: string) {
    pushHistory();
    const ta = textareaRef;
    ta.value += text;
    ta.selectionStart = ta.selectionEnd = ta.value.length;
    ta.focus();
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function wrapSelection(wrapper: string, placeholder = "text") {
    pushHistory();
    const ta = textareaRef;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.substring(start, end);
    const insert = selected
      ? wrapper + selected + wrapper
      : wrapper + placeholder + wrapper;
    ta.value = ta.value.substring(0, start) + insert + ta.value.substring(end);
    const pos = start + insert.length;
    ta.selectionStart = ta.selectionEnd = pos;
    ta.focus();
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function insertAtLineStart(text: string) {
    pushHistory();
    const ta = textareaRef;
    const pos = ta.selectionStart;
    const before = ta.value.substring(0, pos);
    const lineStart = before.lastIndexOf("\n") + 1;
    ta.value =
      ta.value.substring(0, lineStart) + text + ta.value.substring(lineStart);
    const newPos = lineStart + text.length;
    ta.selectionStart = ta.selectionEnd = newPos;
    ta.focus();
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function toggleHeadingMenu() {
    showHeadingMenu = !showHeadingMenu;
    if (showHeadingMenu && headingBtnRef) {
      const r = headingBtnRef.getBoundingClientRect();
      headingDropdownStyle = `position:fixed;top:${r.bottom + 4}px;left:${r.left}px;`;
    }
  }

  function insertHeading(level: number) {
    insertAtLineStart("#".repeat(level) + " ");
    showHeadingMenu = false;
  }

  function insertImage() {
    fileInput?.click();
  }

  async function onImageSelected() {
    const file = fileInput?.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop() || "png";
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    const fileName = `image_${ts}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const data = Array.from(new Uint8Array(arrayBuffer));
    const workspace = await getWorkspaceDir();
    const relPath = await invoke("copy_file_to_assets", {
      workspace,
      fileName,
      data,
    });
    insertAtCursor(`\n![${file.name}](${relPath})\n`);
    fileInput.value = "";
  }

  function insertTable() {
    const isArabic = tableLang === "arabic";
    const h = isArabic ? "عنوان" : "Header";
    const c = isArabic ? "خلية" : "Cell";
    const sep =
      tableAlign === "left"
        ? ":---"
        : tableAlign === "center"
          ? ":---:"
          : "---:";
    const header =
      "| " +
      Array.from({ length: tableCols }, (_, i) => ` ${h} ${i + 1} `).join("|") +
      " |";
    const divider =
      "| " + Array.from({ length: tableCols }, () => sep).join(" | ") + " |";
    const rows = Array.from(
      { length: tableRows },
      (_, i) =>
        "| " +
        Array.from(
          { length: tableCols },
          (_, j) => ` ${c} ${i + 1}.${j + 1} `,
        ).join("|") +
        " |",
    ).join("\n");
    const captionLine = isArabic ? "جدول: " : "Table: ";
    insertAtCursor(
      "\n" + captionLine + "\n" + header + "\n" + divider + "\n" + rows + "\n",
    );
    showTableDialog = false;
  }

  function insertFootnote() {
    const ta = textareaRef;
    const matches = ta.value.match(/\[\^(\d+)\]/g);
    const n = matches ? matches.length + 1 : 1;
    insertAtCursor(`[^${n}]تمت الإضافة\n\n[^${n}]: `);
  }

  function openEquationDialog() {
    showEquationDialog = true;
  }

  function insertEnvironmentBlock(type: string) {
    pushHistory();
    const ta = textareaRef;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const opening = `\n::: ${type}\n`;
    const text = opening + "\n:::\n";
    ta.value = ta.value.substring(0, start) + text + ta.value.substring(end);
    const pos = start + opening.length;
    ta.selectionStart = ta.selectionEnd = pos;
    ta.focus();
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function insertWikiLink(name: string) {
    showWikiLinkDialog = false;
    wikiLinkSearch = "";
    insertAtCursor(`[[${name}]]`);
  }

  function insertPoetry() {
    pushHistory();
    const ta = textareaRef;
    const text = "\n```poetry\n|| \n|| \n```";
    const start = ta.selectionStart;
    ta.value =
      ta.value.substring(0, start) + text + ta.value.substring(ta.selectionEnd);
    const pos = start + 17;
    ta.selectionStart = ta.selectionEnd = pos;
    ta.focus();
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "y") {
      e.preventDefault();
      redo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      debouncedSave();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "b") {
      e.preventDefault();
      wrapSelection("**", "نص");
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "i") {
      e.preventDefault();
      wrapSelection("*", "نص");
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "t") {
      e.preventDefault();
      showTableDialog = true;
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "l") {
      e.preventDefault();
      const ta = textareaRef;
      const sel = ta.value.substring(ta.selectionStart, ta.selectionEnd);
      sel ? wrapSelection("[", "](url)") : insertAtCursor("[نص الرابط](url)");
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "q") {
      e.preventDefault();
      insertAtLineStart("> ");
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code.startsWith("Digit")) {
      const level = parseInt(e.code.slice(-1));
      if (level >= 1 && level <= 6) {
        e.preventDefault();
        insertHeading(level);
        return;
      }
    }
  }
</script>

<div class="editor-wrapper">
  <!-- Toolbar Row 1 -->
  <div class="toolbar">
    <button class="tb" title="تراجع" on:click={undo}>
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
      </svg>
    </button>
    <button class="tb" title="إعادة" on:click={redo}>
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
      </svg>
    </button>

    <div class="sep"></div>

    <button class="tb" title="عريض" on:click={() => wrapSelection("**", "نص")}>
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><path d="M6 4h7a4 4 0 014 4 4 4 0 01-4 4H6z" /><path
          d="M6 12h8a4 4 0 014 4 4 4 0 01-4 4H6z"
        /><line x1="6" y1="4" x2="6" y2="20" /></svg
      >
    </button>
    <button class="tb" title="مائل" on:click={() => wrapSelection("*", "نص")}>
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><line x1="17" y1="4" x2="9" y2="20" /><line
          x1="19"
          y1="4"
          x2="7"
          y2="4"
        /><line x1="17" y1="20" x2="5" y2="20" /></svg
      >
    </button>
    <button class="tb" title="شطب" on:click={() => wrapSelection("~~", "نص")}>
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><path
          d="M17.5 7.5A3.5 3.5 0 0011 5h-1a3.5 3.5 0 000 7h4a3.5 3.5 0 010 7h-1a3.5 3.5 0 01-5-2.5"
        /><line x1="5" y1="12" x2="19" y2="12" /></svg
      >
    </button>
    <button class="tb" title="كود" on:click={() => wrapSelection("`", "كود")}>
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><polyline points="16 18 22 12 16 6" /><polyline
          points="8 6 2 12 8 18"
        /></svg
      >
    </button>

    <div class="sep"></div>

    <div class="hover-group">
      <button
        class="tb"
        title="عنوان"
        bind:this={headingBtnRef}
        on:click={toggleHeadingMenu}
        style="padding:3px 8px"
      >
        H1
      </button>
      {#if showHeadingMenu}
        <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
        <div
          class="dropdown fixed"
          style={headingDropdownStyle}
          on:click={() => (showHeadingMenu = false)}
        >
          {#each [1, 2, 3, 4, 5, 6] as level}
            <button on:click={() => insertHeading(level)}>H{level}</button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="sep"></div>

    <button
      class="tb"
      title="قائمة مرقمة"
      on:click={() => insertAtLineStart("1. ")}
    >
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><line x1="10" y1="6" x2="21" y2="6" /><line
          x1="10"
          y1="12"
          x2="21"
          y2="12"
        /><line x1="10" y1="18" x2="21" y2="18" /><path d="M4 6h1v4" /><path
          d="M4 10h2"
        /><circle cx="4" cy="16" r="1" /><circle cx="4" cy="18" r="1" /><line
          x1="4"
          y1="17"
          x2="4"
          y2="19"
        /></svg
      >
    </button>
    <button
      class="tb"
      title="قائمة نقطية"
      on:click={() => insertAtLineStart("- ")}
    >
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><line x1="10" y1="6" x2="21" y2="6" /><line
          x1="10"
          y1="12"
          x2="21"
          y2="12"
        /><line x1="10" y1="18" x2="21" y2="18" /><circle
          cx="4"
          cy="6"
          r="1.5"
        /><circle cx="4" cy="12" r="1.5" /><circle
          cx="4"
          cy="18"
          r="1.5"
        /></svg
      >
    </button>

    <div class="sep"></div>

    <button
      class="tb"
      title="رابط"
      on:click={() => {
        const ta = textareaRef;
        const sel = ta.value.substring(ta.selectionStart, ta.selectionEnd);
        sel ? wrapSelection("[", "](url)") : insertAtCursor("[نص الرابط](url)");
      }}
    >
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><path
          d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
        /><path
          d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
        /></svg
      >
    </button>
    <button
      class="tb"
      title="رابط داخلي"
      on:click={() => (showWikiLinkDialog = true)}
    >
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        <polyline points="12 8 12 12 16 12" />
      </svg>
    </button>
    <button class="tb" title="صورة" on:click={insertImage}>
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><rect x="3" y="3" width="18" height="18" rx="2" /><circle
          cx="8.5"
          cy="8.5"
          r="1.5"
        /><path d="M21 15l-5-5L5 21" /></svg
      >
    </button>
    <input
      type="file"
      accept="image/*"
      bind:this={fileInput}
      on:change={onImageSelected}
    />
    <button class="tb" title="هامش" on:click={insertFootnote}>
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><rect x="3" y="3" width="18" height="18" rx="2" /><line
          x1="9"
          y1="8"
          x2="15"
          y2="8"
        /><line x1="9" y1="12" x2="15" y2="12" /><line
          x1="12"
          y1="8"
          x2="12"
          y2="16"
        /></svg
      >
    </button>
    <button class="tb" title="جدول" on:click={() => (showTableDialog = true)}>
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><rect x="3" y="3" width="18" height="18" rx="2" /><line
          x1="3"
          y1="9"
          x2="21"
          y2="9"
        /><line x1="3" y1="15" x2="21" y2="15" /><line
          x1="9"
          y1="3"
          x2="9"
          y2="21"
        /><line x1="15" y1="3" x2="15" y2="21" /></svg
      >
    </button>
    <button
      class="tb"
      title="خط أفقي"
      on:click={() => insertAtCursor("\n---\n")}
    >
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg
      >
    </button>
    <button class="tb" title="اقتباس" on:click={() => insertAtLineStart("> ")}>
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><path d="M3 8h6" /><path d="M3 12h6" /><path d="M3 16h4" /><path
          d="M15 8h6"
        /><path d="M15 12h6" /><path d="M17 16h4" /></svg
      >
    </button>
    <button
      class="tb"
      title="علامات التشكيل"
      on:click={() => (showDiacriticDialog = true)}
    >
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="8" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
        <rect x="13" y="13" width="8" height="8" rx="1.5" />
        <circle cx="7" cy="7" r="1.5" />
        <circle cx="17" cy="7" r="1.5" />
        <circle cx="7" cy="17" r="1.5" />
        <circle cx="17" cy="17" r="1.5" />
      </svg>
    </button>
    <button class="tb" title="تفقيط" on:click={() => (showTafqitDialog = true)}>
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="4" y1="9" x2="20" y2="9" />
        <line x1="4" y1="15" x2="20" y2="15" />
        <line x1="10" y1="3" x2="8" y2="21" />
        <line x1="16" y1="3" x2="14" y2="21" />
      </svg>
    </button>
    <button class="tb" title="التاريخ" on:click={() => (showDateDialog = true)}>
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="16" y1="2" x2="16" y2="6" />
      </svg>
    </button>
  </div>

  {#if showQuranDialog}
    <QuranDialog on:close={() => (showQuranDialog = false)} {appendText} />
  {/if}
  {#if showHadithDialog}
    <HadithDialog on:close={() => (showHadithDialog = false)} {appendText} />
  {/if}
  {#if showCitationDialog}
    <CitationDialog
      on:close={() => (showCitationDialog = false)}
      {insertAtCursor}
    />
  {/if}
  {#if showEquationDialog}
    <EquationDialog
      on:close={() => (showEquationDialog = false)}
      {insertAtCursor}
    />
  {/if}
  {#if showEnvironmentDialog}
    <EnvironmentDialog
      on:close={() => (showEnvironmentDialog = false)}
      insertBlock={insertEnvironmentBlock}
    />
  {/if}
  {#if showDiacriticDialog}
    <DiacriticDialog
      on:close={() => (showDiacriticDialog = false)}
      {insertAtCursor}
    />
  {/if}
  {#if showTafqitDialog}
    <TafqitDialog
      on:close={() => (showTafqitDialog = false)}
      {insertAtCursor}
    />
  {/if}
  {#if showDateDialog}
    <DateDialog on:close={() => (showDateDialog = false)} {insertAtCursor} />
  {/if}
  {#if showDictionaryDialog}
    <DictionaryDialog
      on:close={() => (showDictionaryDialog = false)}
      {appendText}
    />
  {/if}
  {#if showWikiLinkDialog}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="dialog-overlay"
      on:click={() => {
        showWikiLinkDialog = false;
        wikiLinkSearch = "";
      }}
      on:keydown
      role="presentation"
    >
      <!-- svelte-ignore a11y_interactive_supports_focus -->
      <div
        class="dialog wiki-link-dialog"
        on:click|stopPropagation
        on:keydown
        role="dialog"
      >
        <h3>إدراج رابط داخلي</h3>
        <input
          type="text"
          class="wiki-search"
          placeholder="ابحث عن ملاحظة..."
          bind:value={wikiLinkSearch}
          autofocus
        />
        <div class="wiki-note-list">
          {#if filteredNotes.length === 0}
            <div class="empty-msg">لا توجد ملاحظات</div>
          {:else}
            {#each filteredNotes as note (note.id)}
              <button
                class="wiki-note-item"
                on:click={() => insertWikiLink(note.name)}
              >
                <svg
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  fill="none"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="link-icon"
                >
                  <path
                    d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
                  />
                  <path
                    d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
                  />
                </svg>
                <span>{note.name}</span>
              </button>
            {/each}
          {/if}
        </div>
        <div class="dialog-actions">
          <button
            class="btn-cancel"
            on:click={() => {
              showWikiLinkDialog = false;
              wikiLinkSearch = "";
            }}>إلغاء</button
          >
        </div>
      </div>
    </div>
  {/if}

  <textarea
    bind:this={textareaRef}
    dir="auto"
    spellcheck="false"
    class="editor"
    value={content}
    on:input={handleInput}
    on:keydown={handleKeydown}
    on:scroll={onEditorScroll}
  ></textarea>

  <div class="bottom-bar">
    <button class="tb-quran" on:click={() => (showQuranDialog = true)}>
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="11" x2="14" y2="11" />
        <line x1="8" y1="15" x2="12" y2="15" />
      </svg>
      <span>القرآن</span>
    </button>
    <button class="tb-quran" on:click={() => (showHadithDialog = true)}>
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        <circle cx="10" cy="10" r="3" />
        <path d="M16 22c0-3.5-2.7-6-6-6s-6 2.5-6 6" />
      </svg>
      <span>الحديث</span>
    </button>
    <span class="bar-div"></span>
    <button class="tb-quran" on:click={insertPoetry}>
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="M15 5l4 4" />
      </svg>
      <span>شعر</span>
    </button>
    <button class="tb-quran" on:click={() => (showCitationDialog = true)}>
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
      <span>استشهاد</span>
    </button>
    <button class="tb-quran" on:click={() => (showDictionaryDialog = true)}>
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        <circle cx="12" cy="10" r="3" />
        <path d="M12 13v4" />
        <path d="M10 17h4" />
      </svg>
      <span>قاموس</span>
    </button>
    <span class="bar-div"></span>
    <button class="tb-quran" on:click={() => insertAtCursor("\n```\n\n```\n")}>
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><polyline points="8 7 3 12 8 17" /><polyline
          points="16 7 21 12 16 17"
        /><line x1="14" y1="4" x2="10" y2="20" /></svg
      >
      <span>كود</span>
    </button>
    <button class="tb-quran" on:click={openEquationDialog}>
      <svg
        xmlns="http://w3.org"
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
      >
        <path
          d="M 25,20 L 75,20 L 75,30 L 40,30 L 60,50 L 40,70 L 75,70 L 75,80 L 25,80 L 25,75 L 50,50 L 25,25 Z"
          fill="currentColor"
        />
      </svg>
      <span>معادلة</span>
    </button>
    <button class="tb-quran" on:click={() => (showEnvironmentDialog = true)}>
      <svg
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <line x1="15" y1="3" x2="15" y2="21" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
      </svg>
      <span>بيئة</span>
    </button>
  </div>
</div>

{#if showTableDialog}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="dialog-overlay"
    on:click={() => (showTableDialog = false)}
    on:keydown
    role="presentation"
  >
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div class="dialog" on:click|stopPropagation on:keydown role="dialog">
      <h3>إدراج جدول</h3>
      <label
        ><span>الصفوف</span><input
          type="number"
          bind:value={tableRows}
          min="1"
          max="30"
        /></label
      >
      <label
        ><span>الأعمدة</span><input
          type="number"
          bind:value={tableCols}
          min="1"
          max="20"
        /></label
      >
      <label
        ><span>اللغة</span>
        <select bind:value={tableLang}>
          <option value="arabic">عربية</option>
          <option value="english">English</option>
        </select>
      </label>
      <label
        ><span>محاذاة</span>
        <select bind:value={tableAlign}>
          <option value="left">يسار</option>
          <option value="center">وسط</option>
          <option value="right">يمين</option>
        </select>
      </label>
      <div class="dialog-actions">
        <button class="btn-cancel" on:click={() => (showTableDialog = false)}
          >إلغاء</button
        >
        <button class="btn-insert" on:click={insertTable}>إدراج</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .editor-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: 6px;
    flex-shrink: 0;
    overflow-x: auto;
    overflow-y: visible;
  }
  .toolbar::-webkit-scrollbar {
    height: 3px;
  }
  .tb {
    background: none;
    border: none;
    color: var(--fg-muted);
    cursor: pointer;
    padding: 3px 5px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      background 0.15s,
      color 0.15s;
    flex-shrink: 0;
  }
  .tb:hover {
    background: var(--bg-hover);
    color: var(--fg);
  }
  .tb svg {
    width: 18px;
    height: 18px;
  }
  .sep {
    width: 1px;
    height: 20px;
    background: var(--border);
    margin: 0 4px;
    flex-shrink: 0;
  }
  .hover-group {
    position: relative;
  }
  .dropdown {
    z-index: 20;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    min-width: 56px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  .dropdown button {
    background: none;
    border: none;
    color: var(--fg);
    padding: 5px 12px;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    text-align: center;
  }
  .dropdown button:hover {
    background: var(--bg-hover);
  }
  .editor-wrapper :global(textarea.editor) {
    flex: 1;
    min-height: 0;
  }
  .bottom-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 5px 16px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
    position: sticky;
    bottom: 0;
    background: var(--bg);
  }
  .tb-quran {
    background: transparent;
    border: none;
    color: var(--fg-muted);
    cursor: pointer;
    padding: 5px 8px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: all 0.12s ease;
    font-size: 0.9rem;
    letter-spacing: 0.02em;
    font-weight: 700;
    font-family: "Amiri", serif;
  }
  .tb-quran:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--accent);
  }
  .tb-quran:active {
    background: rgba(255, 255, 255, 0.1);
  }
  .tb-quran svg {
    width: 15px;
    height: 15px;
    color: var(--accent);
  }
  .bar-div {
    display: block;
    width: 1px;
    height: 18px;
    background: rgba(255, 255, 255, 0.07);
    margin: 0 5px;
    flex-shrink: 0;
  }
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .dialog {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.5rem;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }
  .dialog h3 {
    margin: 0;
    font-size: 1.1rem;
  }
  .dialog label {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dialog label span {
    min-width: 70px;
    font-size: 0.9rem;
  }
  .dialog input,
  .dialog select {
    flex: 1;
    background: #2a2a2a;
    border: 1px solid var(--border);
    color: var(--fg);
    padding: 4px 8px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.9rem;
  }
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }
  .dialog-actions button {
    padding: 6px 16px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.9rem;
  }
  .btn-cancel {
    background: #333;
    color: var(--fg);
  }
  .btn-insert {
    background: var(--accent);
    color: #fff;
  }
  .btn-insert:hover {
    filter: brightness(1.15);
  }
  .btn-cancel:hover {
    background: #444;
  }
  input[type="file"] {
    display: none;
  }
  .wiki-link-dialog {
    max-height: 400px;
    display: flex;
    flex-direction: column;
  }
  .wiki-search {
    background: #2a2a2a;
    border: 1px solid var(--border);
    color: var(--fg);
    padding: 6px 10px;
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.9rem;
    width: 100%;
    box-sizing: border-box;
  }
  .wiki-search:focus {
    outline: none;
    border-color: var(--accent);
  }
  .wiki-note-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 8px;
    max-height: 250px;
  }
  .wiki-note-item {
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    color: var(--fg);
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.85rem;
    text-align: start;
    width: 100%;
    transition: background 0.15s;
  }
  .wiki-note-item:hover {
    background: var(--bg-hover);
  }
  .wiki-note-item .link-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: var(--accent);
  }
  .wiki-note-item span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .wiki-link-dialog .empty-msg {
    color: var(--fg-muted);
    font-size: 0.85rem;
    padding: 12px 10px;
    text-align: center;
  }
</style>
