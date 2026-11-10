/**
 * HTML sanitisation for everything rendered with `{@html}`.
 *
 * Notes are user content that may come from anywhere (shared projects,
 * pasted text). The preview lives in the same document as the app and can
 * reach the Tauri IPC bridge, so any script in a note would run with the
 * app's privileges. Every HTML sink must go through `sanitizeHtml`.
 *
 * The allowlist keeps what the render pipeline produces: KaTeX HTML + MathML
 * + SVG, highlight.js spans, figures, poetry layout, footnotes, wiki links
 * (`data-note-id`), asset URLs (`asset:` / `http://asset.localhost`).
 */
import DOMPurify from 'dompurify';

/** DOMPurify's default URI rule plus the Tauri `asset:` scheme. */
const ALLOWED_URI = /^(?:(?:https?|mailto|tel|asset):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

/** Inline styles that could overlay or restyle the app outside the preview. */
const UNSAFE_STYLE = /position\s*:\s*fixed|url\s*\(|expression\s*\(|@import|behavior\s*:/i;

let purifier: ReturnType<typeof DOMPurify> | null = null;

function getPurifier(): ReturnType<typeof DOMPurify> {
  if (purifier) return purifier;
  const p = DOMPurify(window);
  p.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName === 'style' && UNSAFE_STYLE.test(data.attrValue)) {
      data.keepAttr = false;
    }
  });
  purifier = p;
  return p;
}

const CONFIG = {
  USE_PROFILES: { html: true, svg: true, mathMl: true },
  // KaTeX wraps its MathML in <semantics><annotation encoding="application/x-tex">
  ADD_TAGS: ['semantics', 'annotation'],
  ADD_ATTR: ['loading', 'encoding', 'aria-hidden', 'dir'],
  FORBID_TAGS: [
    'style', 'link', 'meta', 'base', 'iframe', 'frame', 'object', 'embed',
    'form', 'input', 'button', 'textarea', 'select', 'option', 'template',
  ],
  FORBID_ATTR: ['formaction', 'srcdoc', 'action'],
  ALLOWED_URI_REGEXP: ALLOWED_URI,
  ALLOW_DATA_ATTR: true,
};

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return getPurifier().sanitize(html, CONFIG) as unknown as string;
}
