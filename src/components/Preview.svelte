<script lang="ts">
  import { noteContent, previewRef, bibEntries, citedKeys, missingCitationKeys } from "$lib/stores";
  import { renderMarkdown, getLastCitationResult } from "$lib/markdown";
  import { getWorkspaceDir } from "$lib/fs";
  import { convertFileSrc } from "@tauri-apps/api/core";

  $: content = $noteContent;
  $: entries = $bibEntries;

  let workspaceDir = "";
  let previewEl: HTMLDivElement;
  let html = "";

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

  $: {
    html = resolveAssets(renderMarkdown(content, entries));
    const result = getLastCitationResult();
    $citedKeys = result.usedKeys;
    $missingCitationKeys = result.missingKeys;
  }
</script>

<div bind:this={previewEl} class="preview" dir="auto">{@html html}</div>
