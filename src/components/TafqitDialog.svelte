<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { convertToArabicWords } from "$lib/tafqit";

  export let insertAtCursor: (text: string) => void;

  const dispatch = createEventDispatcher();

  let input = "";
  let result = "";

  const easternDigits: Record<string, string> = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  };

  function normalizeDigits(s: string): string {
    return s.replace(/[٠-٩]/g, (d) => easternDigits[d] ?? d);
  }

  function update(e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    input = raw;
    const normalized = normalizeDigits(raw).replace(/[^0-9.,]/g, "").replace(/,/g, ".");
    if (normalized === "" || normalized === ".") {
      result = "";
      return;
    }
    const parts = normalized.split(".");
    const intPart = parts[0];
    if (intPart.length > 12) {
      result = "الرقم كبير جداً (الحد الأقصى 999 مليار)";
      return;
    }
    if (parts.length > 2) {
      result = "الرجاء إدخال رقم صحيح";
      return;
    }
    result = convertToArabicWords(normalized);
  }

  function insert() {
    if (!result || result.startsWith("الرقم") || result.startsWith("الرجاء")) return;
    insertAtCursor(result);
    dispatch("close");
  }
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
    class="dialog tafqit-dialog"
    on:click|stopPropagation
    on:keydown
    role="dialog"
  >
    <h3>تفقيط الأعداد</h3>
    <p class="hint">أدخل رقماً لتحويله إلى كتابة عربية (يدعم الكسور)</p>
    <input
      type="text"
      class="num-input"
      placeholder="مثال: 342.50 أو ٣٤٢٫٥٠"
      value={input}
      on:input={update}
      autofocus
      dir="auto"
    />
    <div class="result-box" class:has-result={result && !result.startsWith("الرقم") && !result.startsWith("الرجاء")}>
      {#if result}
        <span class="result-text">{result}</span>
      {:else}
        <span class="result-placeholder">ستظهر النتيجة هنا</span>
      {/if}
    </div>
    <div class="dialog-actions">
      <button class="btn-cancel" on:click={() => dispatch("close")}
        >إلغاء</button
      >
      <button
        class="btn-insert"
        on:click={insert}
        disabled={!result || result.startsWith("الرقم") || result.startsWith("الرجاء")}
      >
        إدراج
      </button>
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
  .tafqit-dialog {
    min-width: 380px;
    max-width: 480px;
  }
  .dialog {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }
  .dialog h3 {
    margin: 0;
    font-size: 1.1rem;
  }
  .hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--fg-muted);
  }
  .num-input {
    background: #2a2a2a;
    border: 1px solid var(--border);
    color: var(--fg);
    padding: 10px 12px;
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 1.2rem;
    direction: ltr;
    text-align: center;
    outline: none;
    transition: border-color 0.15s;
  }
  .num-input:focus {
    border-color: var(--accent);
  }
  .num-input::placeholder {
    color: var(--fg-muted);
    font-size: 0.85rem;
  }
  .result-box {
    background: #1a1a1a;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    direction: rtl;
  }
  .result-box.has-result {
    border-color: var(--accent);
    background: #1f2028;
  }
  .result-text {
    font-size: 1.15rem;
    line-height: 1.6;
  }
  .result-placeholder {
    color: var(--fg-muted);
    font-size: 0.85rem;
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
  .btn-insert:disabled {
    opacity: 0.4;
    cursor: default;
    filter: none;
  }
</style>
