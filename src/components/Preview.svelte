<script lang="ts">
  import {
    noteContent, previewRef, bibEntries, citedKeys, missingCitationKeys,
    digitStyle, ligatureSettings,
    fontSettings, kashidaConfig, hierarchy, activeNoteId, symbolEditorRequest,
  } from "$lib/stores";
  import { mathRegistryVersion } from "$lib/math";
  import { renderDocument, type DigitStyle } from "$lib/markdown";
  import type { BibEntry } from "$lib/bibliography";
  import type { KashidaConfig } from "$lib/stores";
  import { getWorkspaceDir } from "$lib/fs";
  import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
  import { applyKashida, clearKashida } from "$lib/kashida";
  import { wikiLinkResolver } from "$lib/backlinks";
  import { sanitizeHtml } from "$lib/sanitize";
  import { onDestroy, tick } from "svelte";

  const RENDER_DELAY = 150;

  let content = "";
  let entries: BibEntry[] = [];
  $: content = $noteContent;
  $: entries = $bibEntries;

  let workspaceDir = "";
  let previewEl: HTMLDivElement;
  let html = "";
  let prevKashidaEnabled = false;
  let previewStyle = "";
  let renderTimer: ReturnType<typeof setTimeout> | undefined;
  let renderSeq = 0;

  // Rebuilt once per hierarchy change, not on every keystroke.
  let linkResolver = wikiLinkResolver($hierarchy);
  $: linkResolver = wikiLinkResolver($hierarchy);

  $: if (previewEl) $previewRef = previewEl;

  async function init() {
    if (!isTauri()) return; // browser-only preview: no workspace/assets
    workspaceDir = await getWorkspaceDir();
  }
  init();

  function resolveAssets(html: string, wsDir: string): string {
    if (!wsDir) return html;
    return html.replace(
      /src="(assets\/[^"]+)"/g,
      (_, assetPath: string) => `src="${convertFileSrc(wsDir + '/' + assetPath)}"`,
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

  function scheduleRender(
    text: string,
    bib: BibEntry[],
    digit: DigitStyle,
    kashida: KashidaConfig,
    resolver: (name: string) => string | null,
    wsDir: string,
    _mathVersion: number,
  ) {
    if (renderTimer) clearTimeout(renderTimer);
    const seq = ++renderSeq;
    renderTimer = setTimeout(() => {
      renderTimer = undefined;
      void renderNow(seq, text, bib, digit, kashida, resolver, wsDir).catch((e) =>
        console.error("[preview] render failed:", e),
      );
    }, RENDER_DELAY);
  }

  async function renderNow(
    seq: number,
    text: string,
    bib: BibEntry[],
    digit: DigitStyle,
    kashida: KashidaConfig,
    resolver: (name: string) => string | null,
    wsDir: string,
  ) {
    const result = renderDocument(text, {
      bibEntries: bib,
      digitStyle: digit,
      resolveWikiLink: resolver,
    });
    html = sanitizeHtml(resolveAssets(result.html, wsDir));
    $citedKeys = result.citations.used;
    $missingCitationKeys = result.citations.missing;

    // Wait until the new HTML is in the DOM before measuring/applying kashida.
    await tick();
    if (seq !== renderSeq || !previewEl) return;

    if (kashida.enabled) {
      clearKashida(previewEl);
      applyKashida(previewEl, { enabled: true, targetFill: kashida.targetFill });
    } else if (prevKashidaEnabled) {
      clearKashida(previewEl);
    }
    prevKashidaEnabled = kashida.enabled;
  }

  // $mathRegistryVersion: re-render when custom math symbols change.
  $: scheduleRender(content, entries, $digitStyle, $kashidaConfig, linkResolver, workspaceDir, $mathRegistryVersion);

  onDestroy(() => {
    if (renderTimer) clearTimeout(renderTimer);
  });

  function handlePreviewClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    // ⚠ on a formula with an undefined macro → offer to define it (M10 → M9 dialog)
    const issue = target.closest('.sw-math-issue-macro') as HTMLElement | null;
    if (issue) {
      e.preventDefault();
      const name = issue.getAttribute('data-macro');
      if (name) $symbolEditorRequest = { name };
      return;
    }
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

