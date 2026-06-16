import MarkdownIt from 'markdown-it';
import katex from '@traptitech/markdown-it-katex';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import 'katex/dist/katex.min.css';

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const arabicRe = /[\u0600-\u06FF]/;

function renderPoem(str: string): string {
  const lines = str.trim().split('\n');
  const verses = lines
    .filter(l => l.trim())
    .map(l => {
      const parts = l.split('||');
      if (parts.length >= 2) {
        return { sadr: parts[0].trim(), ajuz: parts[1].trim() };
      }
      return { sadr: l.trim(), ajuz: '' };
    });
  if (verses.length === 0) return '';

  const inner = verses.map(v => {
    if (!v.ajuz) {
      return `<div class="poem-verse single"><span class="verse-sadr">${md.utils.escapeHtml(v.sadr)}</span></div>`;
    }
    return `<div class="poem-verse"><span class="verse-sadr">${md.utils.escapeHtml(v.sadr)}</span><div class="verse-gap"></div><span class="verse-ajuz">${md.utils.escapeHtml(v.ajuz)}</span></div>`;
  }).join('\n');

  return `<div class="arabic-poem" dir="rtl">\n${inner}\n</div>`;
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
  highlight(str: string, lang: string): string {
    if (lang === 'poetry') {
      return renderPoem(str);
    }
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

function convertArabicDigits(text: string): string {
  if (!arabicRe.test(text)) return text;
  // Replace digits outside inline code and math delimiters
  return text.split(/(`[^`]*`|\$\$[^$]*\$\$|\$[^$]*\$)/g).map((part, i) => {
    if (i % 2 === 0) {
      return part.replace(/[0-9]/g, d => ARABIC_INDIC[+d]);
    }
    return part;
  }).join('');
}

export function renderMarkdown(text: string): string {
  try {
    // Pre-process: convert digits in Arabic text, skipping code fences
    const lines = text.split('\n');
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trimStart().startsWith('```')) {
        inFence = !inFence;
      } else if (!inFence && !/^ {4}/.test(line)) {
        lines[i] = convertArabicDigits(line);
      }
    }
    const processed = lines.join('\n');

    const html = md.render(processed);
    let htmlOut = html.replace(
      /<(p|h[1-6]|blockquote|pre|table)\b/gi,
      '<$1 dir="auto"',
    );
    htmlOut = htmlOut.replace(
      /<(ul|ol)\b[^>]*>/gi,
      (tag, _p1, offset: number) => {
        const closeLi = htmlOut.indexOf('</li>', offset);
        const content = htmlOut.slice(offset, closeLi);
        const isRtl = /[\u0600-\u06FF]/.test(content);
        return tag.replace(/(ul|ol)\b/, `$1 dir="${isRtl ? 'rtl' : 'ltr'}"`);
      },
    );
    return htmlOut;
  } catch {
    return '<p style="color:#ff6b6b">خطأ في تحليل المعادلات الرياضية</p>';
  }
}
