<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import type { ParsedTable, CellData } from '$lib/table-utils';
  import { cloneTable, parseCsv } from '$lib/table-utils';

  export let table: ParsedTable;
  export let start: number;
  export let end: number;

  const dispatch = createEventDispatcher<{ save: { table: ParsedTable; start: number; end: number }; cancel: void }>();

  let data = cloneTable(table);
  let caption = data.caption;
  let hasRowHeaders = data.hasRowHeaders;
  let autoNum = data.autoNumber;
  let colWidths: (number | undefined)[] = [...(data.colWidths || [])];

  let header: CellData[] = data.header.map(c => ({ ...c }));
  let body: CellData[][] = data.body.map(r => r.map(c => ({ ...c })));

  let focusRow = 0;
  let focusCol = 0;
  let selStartRow = -1;
  let selStartCol = -1;
  let selEndRow = -1;
  let selEndCol = -1;
  let isSelecting = false;
  let showFormatBar = false;
  let formatBarX = 0;
  let formatBarY = 0;
  let formatTarget = '';

  let undoStack: { header: CellData[]; body: CellData[][]; colWidths: (number | undefined)[]; align: ('left' | 'center' | 'right')[]; caption: string; hasRowHeaders: boolean; autoNum: boolean }[] = [];
  let undoIdx = -1;

  const TEXTAREA_LINE_HEIGHT = 22;

  let gridEl: HTMLDivElement;
  let textareaRefs: Record<string, HTMLTextAreaElement> = {};

  function pushUndo() {
    const state = {
      header: header.map(c => ({ ...c })),
      body: body.map(r => r.map(c => ({ ...c }))),
      colWidths: [...colWidths],
      align: [...data.align],
      caption,
      hasRowHeaders,
      autoNum,
    };
    undoStack = undoStack.slice(0, undoIdx + 1);
    undoStack.push(state);
    if (undoStack.length > 50) undoStack.shift();
    undoIdx = undoStack.length - 1;
  }

  function undo() {
    if (undoIdx <= 0) return;
    undoIdx--;
    const state = undoStack[undoIdx];
    header = state.header.map(c => ({ ...c }));
    body = state.body.map(r => r.map(c => ({ ...c })));
    colWidths = [...state.colWidths];
    data.align = [...state.align];
    caption = state.caption;
    hasRowHeaders = state.hasRowHeaders;
    autoNum = state.autoNum;
  }

  pushUndo();

  function cols() {
    const maxBody = body.length > 0 ? Math.max(...body.map(r => r.length)) : 1;
    return Math.max(header.length, maxBody, 1);
  }

  function ensureCols() {
    const n = cols();
    while (header.length < n) header.push({ text: '' });
    for (const row of body) {
      while (row.length < n) row.push({ text: '' });
    }
    while (data.align.length < n) data.align.push('left');
    while (colWidths.length < n) colWidths.push(undefined);
  }

  function isRowSelected(ri: number) {
    if (selStartRow < 0) return false;
    const r1 = Math.min(selStartRow, selEndRow);
    const r2 = Math.max(selStartRow, selEndRow);
    return ri >= r1 && ri <= r2;
  }

  function isColSelected(ci: number) {
    if (selStartCol < 0) return false;
    const c1 = Math.min(selStartCol, selEndCol);
    const c2 = Math.max(selStartCol, selEndCol);
    return ci >= c1 && ci <= c2;
  }

  function isCellSelected(ri: number, ci: number) {
    return isRowSelected(ri) && isColSelected(ci);
  }

  function cellId(ri: number, ci: number) {
    return `c-${ri}-${ci}`;
  }

  async function focusCell(ri: number, ci: number) {
    focusRow = Math.max(0, Math.min(ri, Math.max(body.length - 1, 0)));
    focusCol = Math.max(0, Math.min(ci, cols() - 1));
    await tick();
    const id = cellId(focusRow, focusCol);
    const ta = textareaRefs[id];
    if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length; }
  }

  function selectCells(r1: number, c1: number, r2: number, c2: number) {
    selStartRow = r1; selStartCol = c1;
    selEndRow = r2; selEndCol = c2;
  }

  function clearSelection() {
    selStartRow = -1; selStartCol = -1;
    selEndRow = -1; selEndCol = -1;
  }

  function handleHeaderClick(ci: number) {
    selectCells(0, ci, body.length - 1, ci);
  }

  function handleRowLabelClick(ri: number) {
    selectCells(ri, 0, ri, cols() - 1);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { clearSelection(); dispatch('cancel'); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); handlePaste(); return; }

    const r = focusRow, c = focusCol;
    const maxR = body.length - 1, maxC = cols() - 1;

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        if (c > 0) focusCell(r, c - 1);
        else if (r > 0) focusCell(r - 1, maxC);
      } else {
        if (c < maxC) focusCell(r, c + 1);
        else if (r < maxR) focusCell(r + 1, 0);
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (r < maxR) focusCell(r + 1, c);
      return;
    }

    if (e.key === 'ArrowUp') { e.preventDefault(); if (r > 0) focusCell(r - 1, c); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (r < maxR) focusCell(r + 1, c); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); if (c > 0) focusCell(r, c - 1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); if (c < maxC) focusCell(r, c + 1); return; }
  }

  function handleTextareaInput(e: Event, ri: number, ci: number) {
    const ta = e.target as HTMLTextAreaElement;
    body[ri][ci].text = ta.value;
    autoResize(ta);
    body = body;
  }

  function autoResize(ta: HTMLTextAreaElement) {
    ta.style.height = 'auto';
    ta.style.height = Math.max(TEXTAREA_LINE_HEIGHT, ta.scrollHeight) + 'px';
  }

  function handleHeaderInput(e: Event, ci: number) {
    const ta = e.target as HTMLTextAreaElement;
    header[ci].text = ta.value;
    autoResize(ta);
    header = header;
  }

  async function handlePaste() {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    const pasted = parseCsv(text);
    if (pasted.header.length === 0 || pasted.body.length === 0) return;
    pushUndo();
    header = pasted.header.map(c => ({ ...c }));
    body = pasted.body.map(r => r.map(c => ({ ...c })));
    data.align = [...pasted.align];
    ensureCols();
    await tick();
    focusCell(0, 0);
  }

  function addRowAbove() {
    pushUndo(); ensureCols();
    const n = cols();
    body.unshift(Array(n).fill(0).map(() => ({ text: '' })));
    body = body;
  }

  function addRowBelow() {
    pushUndo(); ensureCols();
    const n = cols();
    body.push(Array(n).fill(0).map(() => ({ text: '' })));
    body = body;
  }

  function removeRow(ri: number) {
    if (body.length <= 1) return;
    pushUndo();
    body.splice(ri, 1);
    body = body;
    if (focusRow >= body.length) focusRow = body.length - 1;
  }

  function addColLeft() {
    pushUndo(); ensureCols();
    header.unshift({ text: '' });
    data.align.unshift('left');
    colWidths.unshift(undefined);
    for (const row of body) row.unshift({ text: '' });
    header = header; colWidths = colWidths;
  }

  function addColRight() {
    pushUndo(); ensureCols();
    header.push({ text: '' });
    data.align.push('left');
    colWidths.push(undefined);
    for (const row of body) row.push({ text: '' });
    header = header; colWidths = colWidths;
  }

  function removeCol(ci: number) {
    if (cols() <= 1) return;
    pushUndo();
    header.splice(ci, 1);
    data.align.splice(ci, 1);
    colWidths.splice(ci, 1);
    for (const row of body) row.splice(ci, 1);
    header = header; colWidths = colWidths;
    if (focusCol >= cols()) focusCol = cols() - 1;
  }

  function cycleAlign(ci: number) {
    const map: Record<string, 'left' | 'center' | 'right'> = { left: 'center', center: 'right', right: 'left' };
    data.align[ci] = map[data.align[ci]];
    data.align = data.align;
  }

  function mergeCells() {
    if (selStartRow < 0) return;
    const r1 = Math.min(selStartRow, selEndRow);
    const r2 = Math.max(selStartRow, selEndRow);
    const c1 = Math.min(selStartCol, selEndCol);
    const c2 = Math.max(selStartCol, selEndCol);
    if (r1 === r2 && c1 === c2) return;
    pushUndo();
    const topLeft = r1 === 0 ? header[c1] : body[r1 - (hasRowHeaders ? 0 : 0)]?.[c1];
    const mergeText = topLeft?.text || '';

    for (let ri = r1; ri <= r2; ri++) {
      for (let ci = c1; ci <= c2; ci++) {
        if (ri === r1 && ci === c1) continue;
        if (ri === 0 && ci < header.length) { header[ci] = { text: '', colspan: 0, rowspan: 0 }; }
        else if (ri > 0 && ci < body[ri - (hasRowHeaders ? 0 : 1)]?.length) {
          body[ri - 1][ci] = { text: '', colspan: 0, rowspan: 0 };
        }
      }
    }

    if (r1 === 0 && c1 < header.length) {
      header[c1] = { text: mergeText, colspan: c2 - c1 + 1, rowspan: r2 - r1 + 1 };
    } else {
      body[r1 - 1][c1] = { text: mergeText, colspan: c2 - c1 + 1, rowspan: r2 - r1 + 1 };
    }
    clearSelection();
    body = body; header = header;
  }

  function unmergeCell(ri: number, ci: number) {
    const cell = ri === 0 ? header[ci] : body[ri - 1]?.[ci];
    if (!cell || ((cell.colspan ?? 1) <= 1 && (cell.rowspan ?? 1) <= 1)) return;
    pushUndo();
    const text = cell.text;
    const cSpan = cell.colspan || 1;
    const rSpan = cell.rowspan || 1;
    for (let r = ri; r < ri + rSpan && r < body.length + 1; r++) {
      for (let c = ci; c < ci + cSpan && c < cols(); c++) {
        if (r === 0 && c < header.length) header[c] = { text: r === ri && c === ci ? text : '' };
        else if (r > 0 && c < body[r - 1].length) body[r - 1][c] = { text: r - 1 === ri && c === ci ? text : '' };
      }
    }
    body = body; header = header;
  }

  function showFormatBarFor(ri: number, ci: number) {
    showFormatBar = true;
    formatTarget = cellId(ri, ci);
    const id = cellId(ri, ci);
    setTimeout(() => {
      const el = document.getElementById('fmt-' + id);
      if (el) {
        const r = el.getBoundingClientRect();
        formatBarX = r.left;
        formatBarY = r.top - 40;
      }
    }, 0);
  }

  function applyFormat(prefix: string, suffix: string) {
    const [ri, ci] = formatTarget.replace('c-', '').split('-').map(Number);
    if (isNaN(ri) || isNaN(ci)) return;
    const cell = ri === 0 ? header[ci] : body[ri - 1]?.[ci];
    if (!cell) return;
    const ta = textareaRefs[formatTarget];
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = cell.text.substring(start, end) || 'نص';
    cell.text = cell.text.substring(0, start) + prefix + selected + suffix + cell.text.substring(end);
    const newPos = start + prefix.length + selected.length + suffix.length;
    ta.value = cell.text;
    ta.focus();
    ta.selectionStart = ta.selectionEnd = newPos;
    autoResize(ta);
    if (ri === 0) header = header; else body = body;
    showFormatBar = false;
  }

  let resizeCol = -1;
  let resizeStartX = 0;
  let resizeStartW = 0;

  function startResize(e: MouseEvent, ci: number) {
    e.preventDefault();
    resizeCol = ci;
    resizeStartX = e.clientX;
    resizeStartW = colWidths[ci] || 100;
    const handler = (ev: MouseEvent) => {
      if (resizeCol < 0) return;
      const delta = ev.clientX - resizeStartX;
      const newW = Math.max(10, resizeStartW + delta / 5);
      colWidths[resizeCol] = Math.round(newW);
      colWidths = colWidths;
    };
    const upHandler = () => {
      resizeCol = -1;
      document.removeEventListener('mousemove', handler);
      document.removeEventListener('mouseup', upHandler);
    };
    document.addEventListener('mousemove', handler);
    document.addEventListener('mouseup', upHandler);
  }

  function handleSave() {
    ensureCols();
    for (const row of body) {
      for (const cell of row) {
        if (cell.colspan === 0) { cell.colspan = undefined; cell.rowspan = undefined; }
      }
    }
    for (const cell of header) {
      if (cell.colspan === 0) { cell.colspan = undefined; cell.rowspan = undefined; }
    }

    const out: ParsedTable = {
      header, body, align: data.align, caption,
      hasRowHeaders, autoNumber: autoNum, colWidths,
    };
    dispatch('save', { table: out, start, end });
  }

  function handleCancel() {
    dispatch('cancel');
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="table-editor-overlay" on:keydown={onKeydown} role="presentation">
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div class="table-editor-card" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && dispatch('cancel')} role="dialog" tabindex="-1">
    <div class="te-header">
      <h3>تعديل الجدول</h3>
      <div class="te-header-tools">
        <label class="te-toggle" title="العمود الأول كرأس">
          <input type="checkbox" bind:checked={hasRowHeaders} /> رأس
        </label>
        <label class="te-toggle" title="ترقيم تلقائي">
          <input type="checkbox" bind:checked={autoNum} /> رقم
        </label>
        <button class="te-btn-sm" on:click={undo} title="تراجع (Ctrl+Z)">↩</button>
      </div>
      <div class="te-actions">
        <button class="te-btn te-btn-primary" on:click={handleSave}>حفظ</button>
        <button class="te-btn te-btn-cancel" on:click={handleCancel}>إلغاء</button>
      </div>
    </div>

    <div class="te-caption-row">
      <input class="te-caption-input" type="text" bind:value={caption} placeholder="تعليق الجدول (اختياري)" />
    </div>

    <div class="te-grid-wrap" bind:this={gridEl} on:paste={(e) => { e.preventDefault(); handlePaste(); }}>
      <table class="te-grid">
        <colgroup>
          <col class="te-corner-col">
          {#each Array(cols()) as _, ci}
            <col style={colWidths[ci] ? `width:${colWidths[ci]}%` : ''}>
          {/each}
          <col class="te-add-col-col">
        </colgroup>
        <thead>
          <tr>
            <th class="te-corner">
              <button class="te-btn-sm" on:click={addColLeft} title="إضافة عمود لليسار">+</button>
            </th>
            {#each header as cell, ci}
              <th
                class:te-col-selected={isColSelected(ci)}
                on:click={() => handleHeaderClick(ci)}
              >
                <div class="te-resize-handle" on:mousedown={(e) => startResize(e, ci)}></div>
                <div class="te-cell-input-wrap">
                  <textarea
                    class="te-input te-input-head"
                    bind:this={textareaRefs['h-' + ci]}
                    value={cell.text}
                    on:input={(e) => handleHeaderInput(e, ci)}
                    on:focus={() => { clearSelection(); showFormatBarFor(0, ci); }}
                    on:blur={() => setTimeout(() => { showFormatBar = false; }, 200)}
                    rows="1"
                    placeholder="عنوان {ci + 1}"
                  ></textarea>
                  <div class="te-col-actions">
                    <button class="te-btn-sm" on:click={() => cycleAlign(ci)} title="تبديل المحاذاة">
                      {data.align[ci] === 'left' ? '←' : data.align[ci] === 'center' ? '↔' : '→'}
                    </button>
                    <button class="te-btn-sm te-btn-remove" on:click={() => removeCol(ci)} title="حذف العمود">✕</button>
                  </div>
                </div>
              </th>
            {/each}
            <th class="te-add-col">
              <button class="te-btn-sm" on:click={addColRight} title="إضافة عمود لليمين">+</button>
            </th>
          </tr>
        </thead>
        <tbody>
          {#each body as row, ri}
            <tr>
              <td class="te-row-actions" on:click={() => handleRowLabelClick(ri)}>
                <span class="te-row-num">{autoNum ? ri + 1 : ''}</span>
                <button class="te-btn-sm" on:click|stopPropagation={() => addRowAbove()} title="إضافة صف فوق">▲</button>
                <button class="te-btn-sm" on:click|stopPropagation={() => addRowBelow()} title="إضافة صف تحت">▼</button>
                <button class="te-btn-sm te-btn-remove" on:click|stopPropagation={() => removeRow(ri)} title="حذف الصف">✕</button>
              </td>
              {#each Array(cols()) as _, ci}
                <td
                  class:te-cell-selected={isCellSelected(ri, ci)}
                  class:te-row-header={hasRowHeaders && ci === 0}
                  on:click={() => { if (!isSelecting) focusCell(ri, ci); }}
                >
                  {#if row[ci] && ((row[ci].colspan ?? 1) <= 0 || (row[ci].rowspan ?? 1) <= 0)}
                    <div class="te-merged-placeholder"></div>
                  {:else}
                    <textarea
                      class="te-input"
                      class:te-input-head={hasRowHeaders && ci === 0}
                      bind:this={textareaRefs[cellId(ri, ci)]}
                      value={row[ci]?.text ?? ''}
                      on:input={(e) => handleTextareaInput(e, ri, ci)}
                      on:focus={() => { clearSelection(); showFormatBarFor(ri + 1, ci); }}
                      on:blur={() => setTimeout(() => { showFormatBar = false; }, 200)}
                      rows="1"
                      placeholder="{ri + 1}.{ci + 1}"
                    ></textarea>
                  {/if}
                </td>
              {/each}
              <td class="te-filler"></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="te-footer">
      <div class="te-footer-left">
        <span class="te-cell-pos">({focusRow + 1}, {focusCol + 1})</span>
        {#if selStartRow >= 0}
          <button class="te-btn-sm" on:click={mergeCells} title="دمج الخلايا المحددة">⊞ دمج</button>
        {/if}
        {#if header[focusCol] && ((header[focusCol].colspan ?? 1) > 1 || (header[focusCol].rowspan ?? 1) > 1)}
          <button class="te-btn-sm" on:click={() => unmergeCell(0, focusCol)} title="إلغاء دمج">⊟ فك</button>
        {/if}
        {#if body[focusRow]?.[focusCol] && ((body[focusRow][focusCol].colspan ?? 1) > 1 || (body[focusRow][focusCol].rowspan ?? 1) > 1)}
          <button class="te-btn-sm" on:click={() => unmergeCell(focusRow + 1, focusCol)} title="إلغاء دمج">⊟ فك</button>
        {/if}
      </div>
      <div class="te-footer-right">
        <span class="te-hint">↑↓←→ تنقل &middot; Tab &middot; Enter &middot; Ctrl+Z تراجع &middot; Ctrl+V لصق</span>
      </div>
    </div>
  </div>
</div>

{#if showFormatBar}
  <div id="fmt-{formatTarget}" class="te-format-bar" style="left:{formatBarX}px;top:{formatBarY}px;">
    <button class="te-btn-sm" on:click={() => applyFormat('**', '**')} title="عريض"><b>غ</b></button>
    <button class="te-btn-sm" on:click={() => applyFormat('*', '*')} title="مائل"><i>م</i></button>
    <button class="te-btn-sm" on:click={() => applyFormat('`', '`')} title="كود"><code>ك</code></button>
    <button class="te-btn-sm" on:click={() => applyFormat('$', '$')} title="صيغة رياضية"><span class="te-math">∑</span></button>
    <button class="te-btn-sm" on:click={() => applyFormat('[', '](url)')} title="رابط">🔗</button>
  </div>
{/if}

<style>
  .table-editor-overlay {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex; align-items: center; justify-content: center;
    z-index: 300; backdrop-filter: blur(3px);
  }
  .table-editor-card {
    background: var(--bg-panel, #1e1e2e);
    border: 1px solid var(--border, #333);
    border-radius: 12px;
    width: min(95vw, 900px); max-height: 90vh;
    display: flex; flex-direction: column;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
  }
  .te-header {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--border, #333);
    flex-shrink: 0;
  }
  .te-header h3 { margin: 0; font-size: 1rem; color: var(--fg, #eee); white-space: nowrap; }
  .te-header-tools { display: flex; align-items: center; gap: 0.5rem; flex: 1; }
  .te-toggle { display: flex; align-items: center; gap: 4px; font-size: 0.78rem; color: var(--fg-muted, #999); cursor: pointer; }
  .te-toggle input { cursor: pointer; }
  .te-actions { display: flex; gap: 0.5rem; }
  .te-btn {
    padding: 6px 18px; border-radius: 6px; border: none;
    font-family: inherit; font-size: 0.85rem; cursor: pointer; transition: filter 0.12s;
  }
  .te-btn:hover { filter: brightness(1.15); }
  .te-btn-primary { background: var(--accent, #e24a7d); color: #fff; }
  .te-btn-cancel { background: #333; color: #bbb; }

  .te-caption-row { padding: 0.5rem 1.25rem; flex-shrink: 0; }
  .te-caption-input {
    width: 100%; box-sizing: border-box;
    background: #2a2a3e; border: 1px solid var(--border, #444);
    color: var(--fg, #ddd); font-size: 0.85rem; padding: 6px 10px;
    border-radius: 6px; font-family: inherit; direction: rtl;
  }
  .te-caption-input:focus { outline: none; border-color: var(--accent, #e24a7d); }

  .te-grid-wrap { overflow: auto; padding: 0.5rem 1.25rem 0.75rem; flex: 1; }
  .te-grid { border-collapse: collapse; width: 100%; min-width: 450px; table-layout: fixed; }
  .te-grid th, .te-grid td {
    border: 1px solid var(--border, #444); padding: 3px; vertical-align: top; position: relative;
  }
  .te-grid th { background: #2a2a3e; }
  .te-corner-col { width: 72px; min-width: 72px; }
  .te-add-col-col { width: 32px; min-width: 32px; }
  .te-corner { width: 72px; min-width: 72px; background: transparent !important; border-color: transparent !important; text-align: center; }
  .te-row-actions {
    width: 72px; min-width: 72px; text-align: center;
    background: #222; display: flex; flex-direction: column;
    gap: 2px; align-items: center; padding: 4px !important; cursor: pointer;
  }
  .te-row-num { font-size: 0.75rem; color: var(--fg-muted, #777); }
  .te-col-actions { display: flex; gap: 2px; justify-content: center; margin-top: 2px; }
  .te-add-col { width: 32px; min-width: 32px; text-align: center; background: transparent !important; border-color: transparent !important; }
  .te-filler { width: 32px; min-width: 32px; background: transparent !important; border-color: transparent !important; }

  .te-input {
    width: 100%; box-sizing: border-box;
    border: 1px solid transparent; background: transparent;
    color: var(--fg, #e0e0e0); font-size: 0.85rem; padding: 4px 6px;
    border-radius: 3px; font-family: inherit; direction: inherit;
    resize: none; overflow: hidden; line-height: 1.4;
    min-height: 22px;
  }
  .te-input:focus { outline: none; border-color: var(--accent, #e24a7d); background: rgba(226, 74, 125, 0.06); }
  .te-input-head { font-weight: 600; }

  .te-row-header .te-input { font-weight: 600; background: rgba(255, 255, 255, 0.03); }

  .te-col-selected { background: rgba(226, 74, 125, 0.08); }
  .te-cell-selected { background: rgba(226, 74, 125, 0.12); outline: 2px solid var(--accent, #e24a7d); }

  .te-merged-placeholder { min-height: 22px; }

  .te-resize-handle {
    position: absolute; top: 0; right: -3px; width: 6px; height: 100%;
    cursor: col-resize; z-index: 5; background: transparent;
  }
  .te-resize-handle:hover { background: var(--accent, #e24a7d); opacity: 0.5; }

  .te-btn-sm {
    background: none; border: 1px solid var(--border, #555);
    color: var(--fg-muted, #999); cursor: pointer;
    padding: 1px 6px; border-radius: 3px; font-size: 0.75rem;
    transition: all 0.1s; line-height: 1.4;
  }
  .te-btn-sm:hover { background: #333; color: var(--fg, #e0e0e0); }
  .te-btn-remove:hover { border-color: #e24a7d; color: #e24a7d; }

  .te-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.5rem 1.25rem; border-top: 1px solid var(--border, #333);
    flex-shrink: 0; font-size: 0.75rem;
  }
  .te-footer-left { display: flex; align-items: center; gap: 0.5rem; }
  .te-footer-right { display: flex; align-items: center; }
  .te-cell-pos { color: var(--fg-muted, #777); font-family: monospace; }
  .te-hint { color: #555; font-size: 0.7rem; }

  .te-format-bar {
    position: fixed; z-index: 500;
    display: flex; gap: 2px; padding: 4px 6px;
    background: #2a2a3e; border: 1px solid var(--border, #555);
    border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  .te-format-bar .te-btn-sm { border: none; font-size: 0.85rem; padding: 3px 8px; }
  .te-math { font-style: italic; font-size: 1.1rem; }
</style>
