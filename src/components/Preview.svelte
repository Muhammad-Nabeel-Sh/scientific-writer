<script lang="ts">
  import { noteContent } from "$lib/stores";
  import { renderMarkdown } from "$lib/markdown";

  $: content = $noteContent;
  $: html = renderMarkdown(content);
</script>

<div class="preview">{@html html}</div>
