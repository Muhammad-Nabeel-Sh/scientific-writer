<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import {
    toHijri,
    toGregorian,
    formatGregorian,
    isValidHijriDate,
    hijriMonths,
    gregMonths,
  } from "$lib/hijri";

  export let insertAtCursor: (text: string) => void;

  const dispatch = createEventDispatcher();

  let gregDay = 1;
  let gregMonth = 1;
  let gregYear = 2026;
  let gregDayName = "";

  let hijriDay = 1;
  let hijriMonth = 1;
  let hijriYear = 1448;
  let hijriDateStr = "";

  let formats = [
    { id: "g-long", label: "ميلادي مطوّل (الأربعاء ١٩ يونيو ٢٠٢٦ م)" },
    { id: "g-short", label: "ميلادي قصير (١٩ يونيو ٢٠٢٦ م)" },
    { id: "g-num", label: "ميلادي عددي (2026/06/19)" },
    { id: "h-long", label: "هجري مطوّل (الأربعاء ٣ محرم ١٤٤٨ هـ)" },
    { id: "h-short", label: "هجري قصير (٣ محرم ١٤٤٨ هـ)" },
    { id: "h-num", label: "هجري عددي (1448/01/03 هـ)" },
  ];
  let selectedFormat = "h-long";

  let syncing = false;

  function updateHijriDisplay() {
    hijriDateStr = `${hijriYear}/${String(hijriMonth).padStart(2, "0")}/${String(hijriDay).padStart(2, "0")}`;
  }

  function syncGtoH() {
    if (syncing) return;
    syncing = true;
    if (!gregYear || !gregMonth || !gregDay) { syncing = false; return; }
    const d = new Date(gregYear, gregMonth - 1, gregDay);
    if (isNaN(d.getTime())) { syncing = false; return; }
    const h = toHijri(d);
    hijriDay = h.day;
    hijriMonth = h.month;
    hijriYear = h.year;
    updateHijriDisplay();
    gregDayName = formatGregorian(d).dayName;
    syncing = false;
  }

  function syncHtoG() {
    if (syncing) return;
    syncing = true;
    if (!hijriYear || !hijriMonth || !hijriDay) { syncing = false; return; }
    if (!isValidHijriDate(hijriYear, hijriMonth, hijriDay)) { syncing = false; return; }
    const g = toGregorian(hijriYear, hijriMonth, hijriDay);
    if (isNaN(g.getTime())) { syncing = false; return; }
    gregDay = g.getDate();
    gregMonth = g.getMonth() + 1;
    gregYear = g.getFullYear();
    gregDayName = formatGregorian(g).dayName;
    updateHijriDisplay();
    syncing = false;
  }

  function setToday() {
    const now = new Date();
    gregDay = now.getDate();
    gregMonth = now.getMonth() + 1;
    gregYear = now.getFullYear();
    gregDayName = formatGregorian(now).dayName;
    const h = toHijri(now);
    hijriDay = h.day;
    hijriMonth = h.month;
    hijriYear = h.year;
    updateHijriDisplay();
  }

  function buildFormatted(): string {
    const g = formatGregorian(new Date(gregYear, gregMonth - 1, gregDay));
    const h = toHijri(new Date(gregYear, gregMonth - 1, gregDay));
    const dow = gregDayName;

    switch (selectedFormat) {
      case "g-long":
        return `${dow} ${g.day} ${g.monthName} ${g.year} م`;
      case "g-short":
        return `${g.day} ${g.monthName} ${g.year} م`;
      case "g-num":
        return `${String(g.year)}/${String(g.month).padStart(2, "0")}/${String(g.day).padStart(2, "0")} م`;
      case "h-long":
        return `${dow} ${h.day} ${h.monthName} ${h.year} هـ`;
      case "h-short":
        return `${h.day} ${h.monthName} ${h.year} هـ`;
      case "h-num":
        return `${h.year}/${String(h.month).padStart(2, "0")}/${String(h.day).padStart(2, "0")} هـ`;
      default:
        return "";
    }
  }

  function insert() {
    insertAtCursor(buildFormatted());
    dispatch("close");
  }

  setToday();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="dialog-overlay"
  on:click={() => dispatch("close")}
  on:keydown
  role="presentation"
>
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    class="dialog date-dialog"
    on:click|stopPropagation
    on:keydown
    role="dialog"
  >
    <h3>إدراج تاريخ</h3>

    <div class="calendar-panels">
      <div class="panel greg-panel">
        <span class="panel-title">ميلادي</span>
        <div class="date-row">
          <select value={gregDay} on:change={(e) => { gregDay = +(e.currentTarget as HTMLSelectElement).value; syncGtoH(); }}>
            {#each Array(31) as _, i}
              <option value={i + 1}>{String(i + 1).padStart(2, "0")}</option>
            {/each}
          </select>
          <select value={gregMonth} on:change={(e) => { gregMonth = +(e.currentTarget as HTMLSelectElement).value; syncGtoH(); }}>
            {#each gregMonths as name, i}
              <option value={i + 1}>{name}</option>
            {/each}
          </select>
          <input
            type="number"
            class="year-input"
            value={gregYear}
            on:input={(e) => { gregYear = +(e.currentTarget as HTMLInputElement).value; syncGtoH(); }}
            min="1900"
            max="2100"
          />
        </div>
        <span class="day-name">{gregDayName}</span>
      </div>

      <div class="panel hijri-panel">
        <span class="panel-title">هجري</span>
        <div class="date-row">
          <select value={hijriDay} on:change={(e) => { hijriDay = +(e.currentTarget as HTMLSelectElement).value; syncHtoG(); }}>
            {#each Array(30) as _, i}
              <option value={i + 1}>{String(i + 1).padStart(2, "0")}</option>
            {/each}
          </select>
          <select value={hijriMonth} on:change={(e) => { hijriMonth = +(e.currentTarget as HTMLSelectElement).value; syncHtoG(); }}>
            {#each hijriMonths as name, i}
              <option value={i + 1}>{name}</option>
            {/each}
          </select>
          <input
            type="number"
            class="year-input"
            value={hijriYear}
            on:input={(e) => { hijriYear = +(e.currentTarget as HTMLInputElement).value; syncHtoG(); }}
            min="1318"
            max="1500"
          />
        </div>
        <span class="hijri-preview">{hijriDateStr} هـ</span>
      </div>
    </div>

    <div class="format-section">
      <span class="section-label">صيغة الإدراج</span>
      <div class="format-grid">
        {#each formats as f}
          <label class="format-option" class:active={selectedFormat === f.id}>
            <input
              type="radio"
              bind:group={selectedFormat}
              value={f.id}
            />
            <span>{f.label}</span>
          </label>
        {/each}
      </div>
    </div>

    <div class="preview-box">
      <span class="preview-text">{buildFormatted()}</span>
    </div>

    <div class="dialog-actions">
      <button class="btn-today" on:click={setToday}>اليوم</button>
      <div class="action-right">
        <button class="btn-cancel" on:click={() => dispatch("close")}
          >إلغاء</button
        >
        <button class="btn-insert" on:click={insert}>إدراج</button>
      </div>
    </div>
  </div>
</div>

<style>
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .date-dialog {
    min-width: 600px;
    max-width: 680px;
  }
  .dialog {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }
  .dialog h3 {
    margin: 0;
    font-size: 1.1rem;
  }
  .calendar-panels {
    display: flex;
    gap: 12px;
  }
  .panel {
    flex: 1;
    background: #1a1a1a;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .panel-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .date-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .date-row select {
    flex: 1;
    background: #2a2a2a;
    border: 1px solid var(--border);
    color: var(--fg);
    padding: 6px 8px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .date-row select:focus {
    border-color: var(--accent);
    outline: none;
  }
  .year-input {
    width: 70px;
    background: #2a2a2a;
    border: 1px solid var(--border);
    color: var(--fg);
    padding: 6px 8px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.85rem;
    text-align: center;
  }
  .year-input:focus {
    border-color: var(--accent);
    outline: none;
  }
  .day-name {
    font-size: 0.8rem;
    color: var(--accent);
    text-align: center;
  }
  .hijri-preview {
    font-size: 0.75rem;
    color: var(--fg-muted);
    text-align: center;
    direction: ltr;
  }
  .format-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .section-label {
    font-size: 0.8rem;
    color: var(--fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .format-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .format-option {
    flex: 1 1 45%;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: #2a2a2a;
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.78rem;
    transition: border-color 0.15s, background 0.15s;
    min-width: 180px;
  }
  .format-option:hover {
    background: #333;
  }
  .format-option.active {
    border-color: var(--accent);
    background: #2a2030;
  }
  .format-option input {
    accent-color: var(--accent);
  }
  .preview-box {
    background: #111;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 14px;
    text-align: center;
    direction: rtl;
  }
  .preview-text {
    font-size: 1rem;
    line-height: 1.5;
  }
  .dialog-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }
  .action-right {
    display: flex;
    gap: 8px;
  }
  .dialog-actions button {
    padding: 6px 16px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.9rem;
  }
  .btn-today {
    background: #2a2a2a;
    color: var(--fg);
  }
  .btn-today:hover {
    background: #3a3a3a;
  }
  .btn-cancel {
    background: #333;
    color: var(--fg);
  }
  .btn-cancel:hover {
    background: #444;
  }
  .btn-insert {
    background: var(--accent);
    color: #fff;
  }
  .btn-insert:hover {
    filter: brightness(1.15);
  }
</style>
