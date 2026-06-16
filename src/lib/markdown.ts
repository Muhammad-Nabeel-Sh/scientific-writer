import MarkdownIt from 'markdown-it';
import katex from '@traptitech/markdown-it-katex';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
  highlight(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const hl = hljs.highlight(str, { language: lang, ignoreIllegals: true });
        return `<pre dir="auto"><code class="hljs language-${lang}">${hl.value}</code></pre>`;
      } catch { /* fall through */ }
    }
    return `<pre dir="auto"><code class="hljs">${md.utils.escapeHtml(str)}</code></pre>`;
  },
}).use(katex, {
  throwOnError: false,
  displayMode: true,
});

export function renderMarkdown(text: string): string {
  try {
    const html = md.render(text);
    return html.replace(
      /<(p|h[1-6]|li|blockquote|pre)\b/gi,
      '<$1 dir="auto"',
    );
  } catch {
    return '<p style="color:#ff6b6b">خطأ في تحليل المعادلات الرياضية</p>';
  }
}
