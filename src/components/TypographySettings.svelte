<script lang="ts">
  import {
    digitStyle,
    ligatureSettings,
    fontSettings,
    kashidaConfig,
    type LigatureSettings,
    type FontSettings,
    type KashidaConfig,
  } from "$lib/stores";
  import { onMount } from "svelte";

  export let show = false;

  let ls: LigatureSettings;
  let fs: FontSettings;
  let kc: KashidaConfig;

  $: ls = $ligatureSettings;
  $: fs = $fontSettings;
  $: kc = $kashidaConfig;

  function close() {
    show = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="overlay" on:click={close} role="presentation">
    <div class="dialog" on:click|stopPropagation role="dialog" tabindex="-1" dir="rtl">
      <div class="dialog-header">
        <h2>إعدادات الطباعة</h2>
        <button class="close-btn" on:click={close}>✕</button>
      </div>

      <div class="dialog-body">
        <!-- Digit Style -->
        <section class="setting-group">
          <h3>الأرقام</h3>
          <label class="setting-row">
            <span class="setting-label">نمط الأرقام</span>
            <select bind:value={$digitStyle}>
              <option value="auto">تلقائي (حسب النص)</option>
              <option value="western">غربية (0123)</option>
              <option value="eastern">شرقية (٠١٢٣)</option>
            </select>
          </label>
        </section>

        <!-- Ligatures -->
        <section class="setting-group">
          <h3>الرابطات الطباعية</h3>
          <label class="setting-row">
            <input type="checkbox" bind:checked={$ligatureSettings.required} disabled />
            <span class="setting-label">الرابطات الأساسية (لام ألف) — إلزامي</span>
          </label>
          <label class="setting-row">
            <input type="checkbox" bind:checked={$ligatureSettings.standard} />
            <span class="setting-label">الرابطات القياسية</span>
          </label>
          <label class="setting-row">
            <input type="checkbox" bind:checked={$ligatureSettings.discretionary} />
            <span class="setting-label">الرابطات الاختيارية</span>
          </label>
        </section>

        <!-- Variable Font -->
        <section class="setting-group">
          <h3>الخط المتغير</h3>
          <label class="setting-row">
            <span class="setting-label">عائلة الخط</span>
            <select bind:value={$fontSettings.family}>
              <option value="Amiri">Amiri</option>
              <option value="Noto Sans Arabic">Noto Sans Arabic</option>
              <option value="Readex Pro">Readex Pro</option>
            </select>
          </label>
          <label class="setting-row">
            <span class="setting-label">حجم الخط: {$fontSettings.fontSize}px</span>
            <input
              type="range"
              min="10"
              max="48"
              step="1"
              bind:value={$fontSettings.fontSize}
            />
          </label>
          <label class="setting-row">
            <span class="setting-label">الوزن: {$fontSettings.weight}</span>
            <input
              type="range"
              min="100"
              max="900"
              step="10"
              bind:value={$fontSettings.weight}
            />
          </label>
          <label class="setting-row">
            <span class="setting-label">التمدد: {$fontSettings.width}%</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              bind:value={$fontSettings.width}
            />
          </label>
          <label class="setting-row">
            <span class="setting-label">الحجم البصري: {$fontSettings.opticalSize}</span>
            <input
              type="range"
              min="8"
              max="144"
              step="1"
              bind:value={$fontSettings.opticalSize}
            />
          </label>
        </section>

        <!-- Kashida -->
        <section class="setting-group">
          <h3>التطويل (الكشيدة)</h3>
          <label class="setting-row">
            <input type="checkbox" bind:checked={$kashidaConfig.enabled} />
            <span class="setting-label">تفعيل التطويل التلقائي</span>
          </label>
          <label class="setting-row">
            <span class="setting-label">عتبة التعبئة: {Math.round($kashidaConfig.targetFill * 100)}%</span>
            <input
              type="range"
              min="50"
              max="99"
              step="1"
              bind:value={$kashidaConfig.targetFill}
            />
          </label>
        </section>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .dialog {
    background: #fff;
    color: #1a1a1a;
    border-radius: 12px;
    width: min(90vw, 420px);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #eee;
  }
  .dialog-header h2 {
    margin: 0;
    font-size: 1.1rem;
  }
  .close-btn {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: #888;
    padding: 4px 8px;
    border-radius: 4px;
  }
  .close-btn:hover {
    background: #f0f0f0;
    color: #333;
  }
  .dialog-body {
    padding: 1rem 1.25rem;
    overflow-y: auto;
  }
  .setting-group {
    margin-bottom: 1.25rem;
  }
  .setting-group h3 {
    margin: 0 0 0.6rem;
    font-size: 0.95rem;
    color: #555;
    border-bottom: 1px solid #eee;
    padding-bottom: 0.3rem;
  }
  .setting-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }
  .setting-label {
    flex: 1;
  }
  .setting-row select {
    font-size: 0.85rem;
    padding: 3px 6px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #fff;
  }
  .setting-row input[type="range"] {
    flex: 1;
    max-width: 160px;
  }
</style>
