<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let insertAtCursor: (text: string) => void;

  const dispatch = createEventDispatcher();

  interface Diacritic {
    char: string;
    label: string;
    desc: string;
  }

  let hoveredItem: Diacritic | null = null;
  let tooltipStyle = "";

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
        {
          char: "\u064B",
          label: "تنوين فتح",
          desc: "تنوين الفتح المتراكب (الإظهار)",
        },
        {
          char: "\u064C",
          label: "تنوين ضم",
          desc: "تنوين الضم المتراكب (الإظهار)",
        },
        {
          char: "\u064D",
          label: "تنوين كسر",
          desc: "تنوين الكسر المتراكب (الإظهار)",
        },
        {
          char: "\u08F0",
          label: "تنوين فتح",
          desc: "تنوين الفتح المتتابع (الإخفاء/الإدغام)",
        },
        {
          char: "\u08F1",
          label: "تنوين ضم",
          desc: "تنوين الضم المتتابع (الإخفاء/الإدغام)",
        },
        {
          char: "\u08F2",
          label: "تنوين كسر",
          desc: "تنوين الكسر المتتابع (الإخفاء/الإدغام)",
        },
      ],
    },
    {
      heading: "علامات الزيادة والحذف والمد",
      items: [
        {
          char: "\u06DF",
          label: "الصفر المستدير",
          desc: "الصفر المستدير (الحرف الزائد مطلقاً)",
        },
        {
          char: "\u06E0",
          label: "الصفر المستطيل ",
          desc: "الصفر المستطيل القائم (الزيادة وصلاً لا وقفاً)",
        },
        {
          char: "\u0670",
          label: "الألف الخنجرية",
          desc: "الألف الخنجرية (الحرف الزائد المُحَدَّد)",
        },
        {
          char: "\u06E5",
          label: "الواو الصغيرة",
          desc: "الواو الصغيرة (علامة مد صغرى)",
        },
        {
          char: "\u06E6",
          label: "الياء الصغيرة",
          desc: "الياء الصغيرة (علامة مد صغرى)",
        },
        {
          char: "\u06E8",
          label: "النون الصغيرة",
          desc: "النون الصغيرة المرتفعة",
        },
        {
          char: "\u0653",
          label: "المد الطويل",
          desc: "علامة المد الطويل (المطّة فوق الحرف)",
        },
        {
          char: "\u0671",
          label: "همزة الوصل",
          desc: "همزة الوصل (توضع فوق الألف)",
        },
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
      heading: "علامات الوقف ومصطلحات الضبط بالمصحف الشريف",
      items: [
        {
          char: "\u06D6",
          label: "صلي",
          desc: "تفيد بأن الوصل أولى مع جواز الوقف",
        },
        {
          char: "\u06D7",
          label: "قلي",
          desc: "تفيد بأن الوقف أولى مع جواز الوصل",
        },
        { char: "\u06DA", label: "ج", desc: "تفيد جواز الوقف" },
        {
          char: "\u06DB",
          label: "النقط المثلثة",
          desc: "تعانق الوقف يفيد جواز الوقف بأحد الموضعين وليس في كليهما",
        },
        { char: "\u06D8", label: "لزوم الوقف", desc: "لزوم الوقف" },
        { char: "\u06D9", label: "النهي عن الوقف", desc: "النهي عن الوقف" },
        {
          char: "\u25CA",
          label: "الإمالة / الإشمام",
          desc: "المعين خالي الوسط (الإمالة / الإشمام)",
        },
        {
          char: "\u08E2",
          label: "التسهيل",
          desc: "النقطة المستديرة المسدودة (التسهيل)",
        },
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
    dispatch("close");
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

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="dialog-overlay"
  on:click={() => dispatch("close")}
  on:keydown
  role="presentation"
>
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    class="dialog diacritic-dialog"
    on:click|stopPropagation
    on:keydown
    role="dialog"
  >
    <div class="dialog-header">
      <h3>إدراج علامة تشكيل</h3>
    </div>
    <div class="dialog-body">
      {#each sections as section}
        <div class="diacritic-section">
          <span class="section-label">{section.heading}</span>
          <div class="diacritic-grid">
            {#each section.items as item}
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
      {/each}
    </div>
    <div class="dialog-actions">
      <button class="btn-cancel" on:click={() => dispatch("close")}
        >إغلاق</button
      >
    </div>
  </div>
</div>

{#if hoveredItem}
  <div class="tooltip" style={tooltipStyle} role="tooltip">
    {hoveredItem.desc}
  </div>
{/if}

<style>
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    overflow: scroll;
  }
  .diacritic-dialog {
    min-width: 500px;
    max-width: 600px;
  }
  .dialog {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    position: relative;
    max-height: 85vh;
  }
  .dialog-header {
    flex-shrink: 0;
    padding: 1.5rem 1.5rem 0;
  }
  .dialog-header h3 {
    margin: 0;
    font-size: 1.1rem;
  }
  .dialog-body {
    flex: 1;
    overflow-y: auto;
    padding: 0 1.5rem;
    margin: 1rem 0;
  }
  .diacritic-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .section-label {
    font-size: 0.8rem;
    color: var(--fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 12px;
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
    gap: 4px;
    background: #fff;
    border: 1px solid #ccc;
    color: #ff2190;
    cursor: pointer;
    padding: 8px 12px;
    border-radius: 8px;
    transition:
      transform 0.15s,
      box-shadow 0.15s,
      border-color 0.15s;
    min-width: 60px;
  }
  .diacritic-btn:hover {
    transform: scale(1.2);
    border-color: var(--accent);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    z-index: 1;
  }
  .diacritic-char {
    font-size: 2.8rem;
    line-height: 1.2;
    direction: ltr;
  }
  .diacritic-label {
    font-size: 0.7rem;
    color: #666;
    white-space: nowrap;
  }
  .tooltip {
    position: fixed;
    transform: translateX(-50%);
    z-index: 110;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 10px 14px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    max-width: 260px;
    pointer-events: none;
    color: #333;
  }
  .tooltip::before {
    content: "";
    position: absolute;
    top: -6px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 12px;
    height: 12px;
    background: #fff;
    border-left: 1px solid #ddd;
    border-top: 1px solid #ddd;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    flex-shrink: 0;
    padding: 0 1.5rem 1rem;
  }
  .btn-cancel {
    padding: 6px 16px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.9rem;
    background: #333;
    color: var(--fg);
  }
  .btn-cancel:hover {
    background: #444;
  }
</style>
