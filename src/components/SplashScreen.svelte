<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";

  const dispatch = createEventDispatcher<{ close: void }>();

  let visible = true;
  let fading = false;

  onMount(() => {
    const timer = setTimeout(() => {
      fading = true;
      setTimeout(() => {
        visible = false;
        dispatch("close");
      }, 500);
    }, 5000);
    return () => clearTimeout(timer);
  });

  function dismiss() {
    if (fading) return;
    fading = true;
    setTimeout(() => {
      visible = false;
      dispatch("close");
    }, 500);
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div
    class="splash-overlay"
    class:fading
    on:click={dismiss}
    on:keydown
    role="presentation"
  >
    <div class="splash-card" dir="rtl">
      <div class="badge">إصدار تجريبي</div>

      <h1 class="title">الكاتب العلمي</h1>
      <p class="subtitle">Scientific Writer</p>
      <p class="tagline">محرر نصوص علمية عربية متكامل</p>

      <div class="divider"></div>

      <section>
        <h2>التقنيات المستخدمة</h2>
        <div class="grid">
          <div class="item">
            <span class="label">الواجهة:</span>SvelteKit · TypeScript · Vite
          </div>
          <div class="item">
            <span class="label">الحزمة المكتبية:</span>Tauri v2 (Rust) ·
            rusqlite
          </div>
          <div class="item">
            <span class="label">الصياغة:</span>markdown-it · KaTeX ·
            highlight.js
          </div>
          <div class="item">
            <span class="label">الترقيم:</span>@umalqura/core · fuse.js
          </div>
          <div class="item">
            <span class="label">القواميس:</span><a
              href="https://github.com/wizsk/arabic_lexicons">arabic_lexicons</a
            > (11 معجماً)
          </div>
          <div class="item">
            <span class="label">الحديث:</span><a
              href="https://github.com/spearkkk/hadith-json">hadith-json</a
            > (9 كتب)
          </div>
          <div class="item">
            <span class="label">القرآن:</span><a href="https://tanzil.net"
              >Tanzil.net</a
            >
          </div>
        </div>
      </section>

      <div class="divider"></div>

      <section>
        <h2>بمساعدة الذكاء الاصطناعي</h2>
        <div class="ai-grid">
          <span class="ai-badge">OpenCode</span>
          <span class="ai-badge">ChatGPT</span>
          <span class="ai-badge">Qwen</span>
          <span class="ai-badge">Gemini</span>
        </div>
      </section>

      <div class="divider"></div>

      <section class="credit-section">
        <p class="credit-line">د. محمد نبيل شعيشع</p>
        <p class="credit-sub">
          معيد بقسم الاستعاضة الصناعية بكلية طب الأسنان – جامعة فاروس
          بالإسكندرية PUA
        </p>
        <p class="credit-sub">
          طالب ماجستير في برنامج الاستعاضة الصناعية وزراعة الأسنان – جامعة فاروس
          بالإسكندرية PUA
        </p>
      </section>

      <p class="dismiss-hint">اضغط في أي مكان للإغلاق</p>
    </div>
  </div>
{/if}

<style>
  .splash-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    backdrop-filter: blur(4px);
    transition: opacity 0.5s ease;
    opacity: 1;
  }
  .splash-overlay.fading {
    opacity: 0;
  }
  .splash-card {
    background: linear-gradient(145deg, #1a1a2e, #16213e);
    border: 1px solid #2a2a4e;
    border-radius: 16px;
    width: 520px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 2.5rem 2rem;
    text-align: center;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
  }
  .badge {
    display: inline-block;
    font-size: 0.7rem;
    background: rgba(100, 200, 100, 0.15);
    color: #6c6;
    padding: 3px 12px;
    border-radius: 20px;
    border: 1px solid rgba(100, 200, 100, 0.3);
    margin-bottom: 1rem;
  }
  .title {
    font-family: var(--font-serif, serif);
    font-size: 2rem;
    margin: 0;
    color: #e0e0e0;
    letter-spacing: 1px;
  }
  .subtitle {
    font-size: 0.9rem;
    color: var(--fg-muted, #888);
    margin: 0.2rem 0 0.5rem;
    font-family: var(--font-mono, monospace);
    letter-spacing: 2px;
  }
  .tagline {
    font-size: 0.95rem;
    color: #aaa;
    margin: 0 0 1rem;
  }
  .divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, #3a3a5e, transparent);
    margin: 1.2rem 0;
  }
  section {
    margin-bottom: 0.5rem;
  }
  section h2 {
    font-size: 0.85rem;
    color: var(--accent, #58a6ff);
    margin: 0 0 0.8rem;
    font-weight: 600;
    letter-spacing: 1px;
  }
  .grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: right;
  }
  .item {
    font-size: 0.8rem;
    color: #bbb;
    line-height: 1.6;
  }
  .item .label {
    color: #888;
    margin-left: 8px;
    font-size: 0.75rem;
  }
  .item a {
    color: var(--accent, #58a6ff);
  }
  .ai-grid {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .ai-badge {
    padding: 4px 14px;
    border-radius: 20px;
    font-size: 0.8rem;
    background: rgba(200, 160, 255, 0.12);
    color: #c8a0ff;
    border: 1px solid rgba(200, 160, 255, 0.25);
  }
  .credit-section {
    margin-bottom: 0.3rem;
  }
  .credit-line {
    font-size: 1.1rem;
    font-weight: 600;
    color: #e0e0e0;
    margin: 0 0 0.3rem;
    font-family: var(--font-serif, serif);
  }
  .credit-sub {
    font-size: 0.75rem;
    color: #888;
    margin: 0.15rem 0;
  }
  .dismiss-hint {
    font-size: 0.7rem;
    color: #555;
    margin-top: 1rem;
  }
</style>
