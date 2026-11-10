<script lang="ts">
  import {
    noteContent, previewRef, bibEntries, citedKeys, missingCitationKeys,
    digitStyle, ligatureSettings,
    fontSettings, kashidaConfig, hierarchy, activeNoteId,
  } from "$lib/stores";
  import { renderMarkdown, getLastCitationResult } from "$lib/markdown";
  import { getWorkspaceDir } from "$lib/fs";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { applyKashida, clearKashida } from "$lib/kashida";
  import { renderWikiLinks } from "$lib/backlinks";
  import { sanitizeHtml } from "$lib/sanitize";

  $: content = $noteContent;
  $: entries = $bibEntries;

  let workspaceDir = "";
  let previewEl: HTMLDivElement;
  let html = "";
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
    let rendered = renderMarkdown(content, entries, $digitStyle);
    rendered = renderWikiLinks(rendered, $hierarchy);
    html = sanitizeHtml(resolveAssets(rendered));
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

<div bind:this={previewEl} class="preview" dir="auto" style={previewStyle} on:click={handlePreviewClick} on:keydown={handlePreviewKeydown} role="none">{@html html}</div>

