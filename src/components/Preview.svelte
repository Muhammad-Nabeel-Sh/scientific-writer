<script lang="ts">
  import {
    noteContent, previewRef, bibEntries, citedKeys, missingCitationKeys,
    endnoteMode as endnoteModeStore, digitStyle, ligatureSettings,
    fontSettings, kashidaConfig, hierarchy, activeNoteId,
  } from "$lib/stores";
  import { renderMarkdown, getLastCitationResult } from "$lib/markdown";
  import { getWorkspaceDir } from "$lib/fs";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { setEndnoteMode } from "$lib/footnotes";
  import { applyKashida, clearKashida } from "$lib/kashida";
  import { renderWikiLinks } from "$lib/backlinks";
  import TypographySettings from "./TypographySettings.svelte";

  $: content = $noteContent;
  $: entries = $bibEntries;

  let workspaceDir = "";
  let previewEl: HTMLDivElement;
  let html = "";
  let showTypoSettings = false;
  let prevKashidaEnabled = false;
  let previewStyle = "";

  $: if (previewEl) $previewRef = previewEl;

  async function init() {
    workspaceDir = await getWorkspaceDir();
  }
  init();

  function resolveAssets(html: string): string {
    if (!workspaceDir) return html;
    return html.replace(
      /src="(assets\/[^"]+)"/g,
      (_, assetPath: string) => `src="${convertFileSrc(workspaceDir + '/' + assetPath)}"`,
    );
  }

  function ligatureSettingsCSS(): string {
    const s = $ligatureSettings;
    const parts: string[] = [];
    if (!s.required) parts.push('"rlig" 0');
    if (!s.standard) parts.push('"liga" 0');
    if (s.discretionary) parts.push('"dlig" 1');
    return parts.join(', ');
  }

  function fontSettingsCSS(): string {
    const f = $fontSettings;
    const widthAxis = f.family === 'Readex Pro' ? 'HEXP' : 'wdth';
    return `"wght" ${f.weight}, "opsz" ${f.opticalSize}, "${widthAxis}" ${f.width}`;
  }

  $: previewStyle = `font-family: ${$fontSettings.family}, 'Amiri', 'Noto Sans Arabic', 'Readex Pro', serif; font-weight: ${$fontSettings.weight}; font-size: ${$fontSettings.fontSize}px; font-variation-settings: ${fontSettingsCSS()}; font-feature-settings: ${ligatureSettingsCSS() || 'normal'};`;

  $: {
    setEndnoteMode($endnoteModeStore);
    let rendered = renderMarkdown(content, entries, $digitStyle);
    rendered = renderWikiLinks(rendered, $hierarchy);
    html = resolveAssets(rendered);
    const result = getLastCitationResult();
    $citedKeys = result.usedKeys;
    $missingCitationKeys = result.missingKeys;

    // Read at top level to ensure Svelte tracks them as dependencies
    const kashEnabled = $kashidaConfig.enabled;
    const targetFill = $kashidaConfig.targetFill;

    if (previewEl && kashEnabled) {
      requestAnimationFrame(() => {
        clearKashida(previewEl);
        applyKashida(previewEl, { enabled: true, targetFill });
      });
    } else if (previewEl && prevKashidaEnabled && !kashEnabled) {
      clearKashida(previewEl);
    }
    prevKashidaEnabled = kashEnabled;
  }

  function handlePreviewClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const link = target.closest('a.wiki-link-resolved') as HTMLAnchorElement | null;
    if (link) {
      e.preventDefault();
      const noteId = link.getAttribute('data-note-id');
      if (noteId) {
        $activeNoteId = noteId;
      }
    }
  }

  function handlePreviewKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handlePreviewClick(e as unknown as MouseEvent);
    }
  }
</script>

<div class="preview-header">
  <label class="endnote-toggle">
    <input type="checkbox" bind:checked={$endnoteModeStore} />
    الحواشي الختامية
  </label>
  <button class="typo-btn" on:click={() => (showTypoSettings = true)} title="إعدادات الطباعة">
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" />
    </svg>
    طباعة
  </button>
</div>
<div bind:this={previewEl} class="preview" dir="auto" style={previewStyle} on:click={handlePreviewClick} on:keydown={handlePreviewKeydown} role="none">{@html html}</div>

<TypographySettings bind:show={showTypoSettings} />

<style>
  .preview-header {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 1rem 0;
    background: #fff;
    border-bottom: 1px solid #eee;
  }
  .endnote-toggle {
    font-size: 0.85rem;
    color: #555;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    user-select: none;
  }
  .endnote-toggle input {
    cursor: pointer;
  }
  .typo-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
    background: none;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 3px 8px;
    cursor: pointer;
    color: #555;
    font-family: inherit;
    transition: background 0.15s;
  }
  .typo-btn:hover {
    background: #f0f0f0;
    color: #333;
  }
</style>
