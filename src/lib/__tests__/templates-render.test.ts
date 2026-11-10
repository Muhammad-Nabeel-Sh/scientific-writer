import { describe, it, expect } from 'vitest';
import { getAllTemplates } from '$lib/templates';
import { renderMarkdown } from '$lib/markdown';

describe('built-in templates render cleanly', () => {
  for (const tpl of getAllTemplates()) {
    it(tpl.id, () => {
      const { samples } = tpl.generate();
      for (const [id, md] of Object.entries(samples)) {
        const html = renderMarkdown(md);
        // no stray container fences left as text (e.g. nested ":::page")
        expect(html, `${tpl.id}/${id}`).not.toMatch(/<p[^>]*>:::+<\/p>/);
      }
    });
  }
});
