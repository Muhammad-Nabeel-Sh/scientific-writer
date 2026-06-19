<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";

  export let insertAtCursor: (text: string) => void;

  const dispatch = createEventDispatcher();

  interface Diacritic {
    char: string;
    label: string;
    desc: string;
  }

  let hoveredItem: Diacritic | null = null;
  let tooltipStyle = "";
  let paletteX = 80;
  let paletteY = 80;
  let dragging = false;
  let dragOffX = 0;
  let dragOffY = 0;
  let activeTab = 0;
  let paletteEl: HTMLDivElement;

  onMount(() => {
    const r = paletteEl.getBoundingClientRect();
    paletteX = window.innerWidth - r.width - 24;
    paletteY = 80;
  });

  const sections: { heading: string; items: Diacritic[] }[] = [
    {
      heading: "الحركات الأساسية",
      items: [
        { char: "\u064E", label: "فتحة", desc: "الفتحة العادية" },
        { char: "\u064F", label: "ضمة", desc: "الضمة العادية" },
        { char: "\u0650", label: "كسرة", desc: "الكسرة العادية" },
      ],
    },
    {
      heading: "علامات السكون والتشديد والقلب",
      items: [
        { char: "\u0652", label: "سكون", desc: "سكون" },
        {
          char: "\u06E1",
          label: "السكون القرآني",
          desc: "السكون القرآني (رأس خاء خالية من النقط)",
        },
        { char: "\u0651", label: "شدة", desc: "شدة" },
        {
          char: "\u06E2",
          label: "قلب",
          desc: "الميم الصغيرة فوق الحرف (علامة الإقلاب)",
        },
        { char: "\u0651\u064E", label: "شدة فتحة", desc: "شدة فتحة" },
        { char: "\u0651\u064F", label: "شدة ضمة", desc: "شدة ضمة" },
        { char: "\u0651\u0650", label: "شدة كسرة", desc: "شدة كسرة" },
      ],
    },
    {
      heading: "التنوين",
      items: [
        { char: "\u064B", label: "تنوين فتح", desc: "تنوين الفتح المتراكب (الإظهار)" },
        { char: "\u064C", label: "تنوين ضم", desc: "تنوين الضم المتراكب (الإظهار)" },
        { char: "\u064D", label: "تنوين كسر", desc: "تنوين الكسر المتراكب (الإظهار)" },
        { char: "\u08F0", label: "تنوين فتح", desc: "تنوين الفتح المتتابع (الإخفاء/الإدغام)" },
        { char: "\u08F1", label: "تنوين ضم", desc: "تنوين الضم المتتابع (الإخفاء/الإدغام)" },
        { char: "\u08F2", label: "تنوين كسر", desc: "تنوين الكسر المتتابع (الإخفاء/الإدغام)" },
      ],
    },
    {
      heading: "علامات الزيادة والحذف والمد",
      items: [
        { char: "\u06DF", label: "الصفر المستدير", desc: "الصفر المستدير (الحرف الزائد مطلقاً)" },
        { char: "\u06E0", label: "الصفر المستطيل", desc: "الصفر المستطيل القائم (الزيادة وصلاً لا وقفاً)" },
        { char: "\u0670", label: "الألف الخنجرية", desc: "الألف الخنجرية (الحرف الزائد المُحَدَّد)" },
        { char: "\u06E5", label: "الواو الصغيرة", desc: "الواو الصغيرة (علامة مد صغرى)" },
        { char: "\u06E6", label: "الياء الصغيرة", desc: "الياء الصغيرة (علامة مد صغرى)" },
        { char: "\u06E8", label: "النون الصغيرة", desc: "النون الصغيرة المرتفعة" },
        { char: "\u0653", label: "المد الطويل", desc: "علامة المد الطويل (المطّة فوق الحرف)" },
        { char: "\u0671", label: "همزة الوصل", desc: "همزة الوصل (توضع فوق الألف)" },
      ],
    },
    {
      heading: "الهمزات",
      items: [
        { char: "\u0621", label: "همزة", desc: "..." },
        { char: "\u0623", label: "أ", desc: "..." },
        { char: "\u0625", label: "إ", desc: "..." },
        { char: "\u0622", label: "آ", desc: "..." },
        { char: "\u0624", label: "ؤ", desc: "..." },
        { char: "\u0626", label: "ئ", desc: "..." },
      ],
    },
    {
      heading: "علامات خاصة",
      items: [
        { char: "\u0671", label: "وصلة", desc: "..." },
        { char: "\u0640", label: "تطويل", desc: "..." },
        { char: "\u060C", label: "فاصلة", desc: "..." },
        { char: "\u061B", label: "فاصلة منقوطة", desc: "..." },
        { char: "\u061F", label: "استفهام", desc: "..." },
        {
          char: "\u0614",
          label: "التصحيح",
          desc: "توضع فوق الكلمة الملحقة أو المصححة في الهامش لتدل على أن هذه الرواية صحيحة وثابتة",
        },
        {
          char: "\u062D",
          label: "التحويل",
          desc: "حاء مهملة مفردة تُستعمل عند الانتقال من سند إلى سند آخر في الحديث",
        },
      ],
    },
    {
      heading: "علامات قرآنية",
      items: [
        { char: "\u06DD", label: "نهاية آية", desc: "..." },
        { char: "\u06DE", label: "بداية حزب", desc: "..." },
        { char: "\u06E9", label: "علامة سجدة", desc: "..." },
      ],
    },
    {
      heading: "الوقف",
      items: [
        { char: "\u06D6", label: "صلي", desc: "تفيد بأن الوصل أولى مع جواز الوقف" },
        { char: "\u06D7", label: "قلي", desc: "تفيد بأن الوقف أولى مع جواز الوصل" },
        { char: "\u06DA", label: "ج", desc: "تفيد جواز الوقف" },
        { char: "\u06DB", label: "النقط المثلثة", desc: "تعانق الوقف يفيد جواز الوقف بأحد الموضعين وليس في كليهما" },
        { char: "\u06D8", label: "لزوم الوقف", desc: "لزوم الوقف" },
        { char: "\u06D9", label: "النهي عن الوقف", desc: "النهي عن الوقف" },
        { char: "\u25CA", label: "الإمالة / الإشمام", desc: "المعين خالي الوسط (الإمالة / الإشمام)" },
        { char: "\u08E2", label: "التسهيل", desc: "النقطة المستديرة المسدودة (التسهيل)" },
        { char: "\u06EA", label: "وقف منخفض", desc: "..." },
        { char: "\u06EB", label: "وقف مرتفع", desc: "..." },
      ],
    },
    {
      heading: "بسملة وصلوات",
      items: [
        { char: "\uFDFD", label: "بسملة", desc: "..." },
        { char: "\uFDFB", label: "جل جلاله", desc: "..." },
        { char: "\uFDFA", label: "صلى الله عليه وسلم", desc: "..." },
        { char: "\uFDF4", label: "محمد", desc: "..." },
      ],
    },
  ];

  function insert(char: string) {
    insertAtCursor(char);
  }

  function onDragStart(e: MouseEvent) {
    dragging = true;
    dragOffX = e.clientX - paletteX;
    dragOffY = e.clientY - paletteY;
  }

  function onDragMove(e: MouseEvent) {
    if (!dragging) return;
    paletteX = e.clientX - dragOffX;
    paletteY = e.clientY - dragOffY;
  }

  function onDragEnd() {
    dragging = false;
  }

  function showTooltip(item: Diacritic, e: MouseEvent) {
    hoveredItem = item;
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    tooltipStyle = `top:${r.bottom + 8}px;left:${r.left + r.width / 2}px;`;
  }

  function hideTooltip() {
    hoveredItem = null;
  }
</script>

<svelte:window on:mousemove={onDragMove} on:mouseup={onDragEnd} />

<div
  class="palette"
  bind:this={paletteEl}
  style="left:{paletteX}px;top:{paletteY}px;"
  role="dialog"
  aria-label="لوحة علامات التشكيل"
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="palette-header"
    on:mousedown={onDragStart}
    role="presentation"
  >
    <svg class="drag-icon" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
    </svg>
    <span class="palette-title">علامات التشكيل</span>
    <button
      class="close-btn"
      on:click={() => dispatch("close")}
      aria-label="إغلاق"
    >
      <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </div>

  <div class="palette-tabs">
    {#each sections as section, i}
      <button
        class="tab-pill"
        class:active={i === activeTab}
        on:click={() => (activeTab = i)}
      >
        {section.heading}
      </button>
    {/each}
  </div>

  <div class="palette-body">
    <div class="diacritic-grid">
      {#each sections[activeTab].items as item}
        <button
          class="diacritic-btn"
          title={item.label}
          on:click={() => insert(item.char)}
          on:mouseenter={(e) => showTooltip(item, e)}
          on:mouseleave={hideTooltip}
        >
          <span class="diacritic-char">{item.char}</span>
          <span class="diacritic-label">{item.label}</span>
        </button>
      {/each}
    </div>
  </div>
</div>

{#if hoveredItem}
  <div class="tooltip" style={tooltipStyle} role="tooltip">
    {hoveredItem.desc}
  </div>
{/if}

<style>
  .palette {
    position: fixed;
    z-index: 100;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
    min-width: 340px;
    max-width: 400px;
    user-select: none;
  }
  .palette-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    cursor: grab;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .palette-header:active {
    cursor: grabbing;
  }
  .drag-icon {
    width: 16px;
    height: 16px;
    color: var(--fg-muted);
    flex-shrink: 0;
  }
  .palette-title {
    flex: 1;
    font-size: 0.9rem;
    font-weight: 600;
  }
  .close-btn {
    background: none;
    border: none;
    color: var(--fg-muted);
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .close-btn:hover {
    color: var(--fg);
    background: var(--bg-hover);
  }
  .close-btn svg {
    width: 18px;
    height: 18px;
  }
  .palette-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 8px 12px 0;
    flex-shrink: 0;
    max-height: 82px;
    overflow-y: auto;
  }
  .tab-pill {
    flex-shrink: 0;
    background: none;
    border: 1px solid var(--border);
    color: var(--fg-muted);
    cursor: pointer;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 0.72rem;
    font-family: inherit;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .tab-pill:hover {
    background: var(--bg-hover);
    color: var(--fg);
  }
  .tab-pill.active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }
  .palette-body {
    padding: 10px 12px;
    overflow-y: auto;
    max-height: 320px;
  }
  .diacritic-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .diacritic-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    background: #fff;
    border: 1px solid #ccc;
    color: #ff2190;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 8px;
    transition: transform 0.12s, box-shadow 0.12s, border-color 0.12s;
    min-width: 54px;
  }
  .diacritic-btn:hover {
    transform: scale(1.15);
    border-color: var(--accent);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    z-index: 1;
  }
  .diacritic-char {
    font-size: 2.2rem;
    line-height: 1.2;
    direction: ltr;
  }
  .diacritic-label {
    font-size: 0.65rem;
    color: #666;
    white-space: nowrap;
  }
  .tooltip {
    position: fixed;
    transform: translateX(-50%);
    z-index: 110;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 8px 12px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    max-width: 260px;
    pointer-events: none;
    color: #333;
    font-size: 0.8rem;
    line-height: 1.4;
  }
  .tooltip::before {
    content: "";
    position: absolute;
    top: -6px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 10px;
    height: 10px;
    background: #fff;
    border-left: 1px solid #ddd;
    border-top: 1px solid #ddd;
  }
</style>
