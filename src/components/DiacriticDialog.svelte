<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let insertAtCursor: (text: string) => void;

  const dispatch = createEventDispatcher();

  interface Diacritic {
    char: string;
    label: string;
  }

  const sections: { heading: string; items: Diacritic[] }[] = [
    {
      heading: "الحركات الأساسية",
      items: [
        { char: "\u064E", label: "فتحة" },
        { char: "\u064F", label: "ضمة" },
        { char: "\u0650", label: "كسرة" },
        { char: "\u0652", label: "سكون" },
        { char: "\u0651", label: "شدة" },
      ],
    },
    {
      heading: "التنوين",
      items: [
        { char: "\u064B", label: "تنوين فتح" },
        { char: "\u064C", label: "تنوين ضم" },
        { char: "\u064D", label: "تنوين كسر" },
        { char: "\u0670", label: "ألف خنجرية" },
      ],
    },
    {
      heading: "شدة + حركة",
      items: [
        { char: "\u0651\u064E", label: "شدة فتحة" },
        { char: "\u0651\u064F", label: "شدة ضمة" },
        { char: "\u0651\u0650", label: "شدة كسرة" },
      ],
    },
    {
      heading: "الهمزات",
      items: [
        { char: "\u0621", label: "همزة" },
        { char: "\u0623", label: "أ" },
        { char: "\u0625", label: "إ" },
        { char: "\u0622", label: "آ" },
        { char: "\u0624", label: "ؤ" },
        { char: "\u0626", label: "ئ" },
      ],
    },
    {
      heading: "علامات خاصة",
      items: [
        { char: "\u0671", label: "وصلة" },
        { char: "\u0640", label: "تطويل" },
        { char: "\u060C", label: "فاصلة" },
        { char: "\u061B", label: "فاصلة منقوطة" },
        { char: "\u061F", label: "استفهام" },
      ],
    },
    {
      heading: "علامات قرآنية",
      items: [
        { char: "\u06DD", label: "نهاية آية" },
        { char: "\u06DE", label: "بداية حزب" },
        { char: "\u06E9", label: "علامة سجدة" },
      ],
    },
    {
      heading: "حروف صغيرة (رسم عثماني)",
      items: [
        { char: "\u06D6", label: "سين صغيرة" },
        { char: "\u06D7", label: "صاد صغيرة" },
        { char: "\u06DA", label: "نون صغيرة" },
        { char: "\u06DB", label: "واو صغيرة" },
        { char: "\u06DC", label: "ياء صغيرة" },
        { char: "\u06E5", label: "واو صغرى" },
        { char: "\u06E6", label: "ياء صغرى" },
        { char: "\u06E4", label: "مدة صغيرة" },
        { char: "\u06EA", label: "وقف منخفض" },
        { char: "\u06EB", label: "وقف مرتفع" },
      ],
    },
    {
      heading: "بسملة وصلوات",
      items: [
        { char: "\uFDFD", label: "بسملة" },
        { char: "\uFDFA", label: "صلى الله عليه وسلم" },
        { char: "\uFDFB", label: "جل جلاله" },
      ],
    },
  ];

  function insert(char: string) {
    insertAtCursor(char);
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
  <div class="dialog diacritic-dialog" on:click|stopPropagation on:keydown role="dialog">
    <h3>إدراج علامة تشكيل</h3>
    {#each sections as section}
      <div class="diacritic-section">
        <span class="section-label">{section.heading}</span>
        <div class="diacritic-grid">
          {#each section.items as item}
            <button
              class="diacritic-btn"
              title={item.label}
              on:click={() => insert(item.char)}
            >
              <span class="diacritic-char">{item.char}</span>
              <span class="diacritic-label">{item.label}</span>
            </button>
          {/each}
        </div>
      </div>
    {/each}
    <div class="dialog-actions">
      <button class="btn-cancel" on:click={() => dispatch("close")}>إغلاق</button>
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
  .diacritic-dialog {
    min-width: 500px;
    max-width: 600px;
  }
  .dialog {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }
  .dialog h3 {
    margin: 0;
    font-size: 1.1rem;
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
    gap: 2px;
    background: #2a2a2a;
    border: 1px solid var(--border);
    color: var(--fg);
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 6px;
    transition: background 0.15s, border-color 0.15s;
    min-width: 56px;
  }
  .diacritic-btn:hover {
    background: #3a3a3a;
    border-color: var(--accent);
  }
  .diacritic-char {
    font-size: 1.4rem;
    line-height: 1;
  }
  .diacritic-label {
    font-size: 0.7rem;
    color: var(--fg-muted);
    white-space: nowrap;
  }
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
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
