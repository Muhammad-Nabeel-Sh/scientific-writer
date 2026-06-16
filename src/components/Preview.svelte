<script lang="ts">
  import { noteContent } from "$lib/stores";
  import { renderMarkdown } from "$lib/markdown";
  import { getWorkspaceDir } from "$lib/fs";
  import { convertFileSrc } from "@tauri-apps/api/core";

  $: content = $noteContent;

  let workspaceDir = "";

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

<div class="preview">{@html html}</div>
