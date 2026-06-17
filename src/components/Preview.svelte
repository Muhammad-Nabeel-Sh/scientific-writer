<script lang="ts">
  import { noteContent, previewRef } from "$lib/stores";
  import { renderMarkdown } from "$lib/markdown";
  import { getWorkspaceDir } from "$lib/fs";
  import { convertFileSrc } from "@tauri-apps/api/core";

  $: content = $noteContent;

  let workspaceDir = "";
  let previewEl: HTMLDivElement;

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

  $: html = resolveAssets(renderMarkdown(content));
</script>

<div bind:this={previewEl} class="preview" dir="auto">{@html html}</div>
