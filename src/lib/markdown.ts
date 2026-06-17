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

let figCounter = 0;
let figUsedIds = new Set<string>();

function resetFigureState() {
  figCounter = 0;
  figUsedIds = new Set<string>();
}

function genFigureId(src: string): string {
  let base = src.replace(/^.*[/\\]/, '').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-') || 'figure';
  let id = `fig-${base}`;
  if (figUsedIds.has(id)) {
    let i = 2;
    while (figUsedIds.has(`fig-${base}-${i}`)) i++;
    id = `fig-${base}-${i}`;
  }
  figUsedIds.add(id);
  return id;
}

export function parseFigures(markdown: string): FigureInfo[] {
  const figures: FigureInfo[] = [];
  const used = new Set<string>();
  const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  let num = 0;
  while ((m = re.exec(markdown)) !== null) {
    num++;
    const src = m[2];
    const caption = m[1].trim();
    let base = src.replace(/^.*[/\\]/, '').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-') || 'figure';
    let id = `fig-${base}`;
    if (used.has(id)) {
      let i = 2;
      while (used.has(`fig-${base}-${i}`)) i++;
      id = `fig-${base}-${i}`;
    }
    used.add(id);
    figures.push({ id, number: num, src, caption });
  }
  return figures;
}

// Override image renderer — every image becomes a centered figure with auto-numbered caption
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const src = token.attrGet('src') || '';
  const alt = token.content || '';
  const title = token.attrGet('title');

  figCounter++;
  const hasArabic = /[\u0600-\u06FF]/.test(alt);
  const label = hasArabic ? 'الشكل' : 'Figure';
  const id = genFigureId(src);
  const titleAttr = title ? ` title="${md.utils.escapeHtml(title)}"` : '';
  const captionText = alt ? `: ${md.utils.escapeHtml(alt)}` : '';

  return `<figure class="figure" id="${id}">
    <img src="${md.utils.escapeHtml(src)}" alt="${md.utils.escapeHtml(alt)}" loading="lazy"${titleAttr} />
    <figcaption dir="auto">${label} ${figCounter}${captionText}</figcaption>
  </figure>`;
};

function convertArabicDigits(text: string): string {
  if (!arabicRe.test(text)) return text;
  // Replace digits outside inline code and math delimiters
  return text.split(/(`[^`]*`|\$\$[^$]*\$\$|\$[^$]*\$|!\[[^\]]*\]\([^)]*\)|\[[^\]]*\]\([^)]*\))/g).map((part, i) => {
    if (i % 2 === 0) {
      return part.replace(/[0-9]/g, d => ARABIC_INDIC[+d]);
    }
    return part;
  }).join('');
}

export interface FigureInfo {
  id: string;
  number: number;
  src: string;
  caption: string;
}

export interface OutlineItem {
  id: string;
  level: number;
  text: string;
  lineIndex: number;
  charOffset: number;
}

export function parseOutline(markdown: string): OutlineItem[] {
  const lines = markdown.split('\n');
  const items: OutlineItem[] = [];
  let charOffset = 0;
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      charOffset += line.length + 1;
      continue;
    }
    if (!inFence) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        items.push({
          id: `h-${i}`,
          level: match[1].length,
          text: match[2].trim(),
          lineIndex: i,
          charOffset,
        });
      }
    }
    charOffset += line.length + 1;
  }
  return items;
}

export function renderMarkdown(text: string): string {
  try {
    resetFigureState();
    // Pre-process: convert digits and turn soft returns into hard returns
    const lines = text.split('\n');
    let inFence = false;
    const resultLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isFenceLine = line.trimStart().startsWith('```');
      if (isFenceLine) {
        inFence = !inFence;
      }
      if (!inFence && !isFenceLine && !/^ {4}/.test(line)) {
        resultLines.push(convertArabicDigits(line));
      } else {
        resultLines.push(line);
      }
      if (!inFence && !isFenceLine && !line.trimStart().startsWith('|')) {
        resultLines.push(''); // blank line → hard return (new paragraph)
      }
    }
    const processed = resultLines.join('\n');

    const html = md.render(processed);
    let htmlOut = html.replace(
      /<(p|h[1-6]|blockquote|pre|th|td|li)\b/gi,
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
    htmlOut = htmlOut.replace(/<table\b[^>]*>/gi, (match, offset: number) => {
      const endIdx = htmlOut.indexOf('</table>', offset + match.length);
      const content = endIdx > -1 ? htmlOut.slice(offset + match.length, endIdx) : '';
      const isRtl = /[\u0600-\u06FF]/.test(content);
      return `<table dir="${isRtl ? 'rtl' : 'ltr'}"`;
    });
    return htmlOut;
  } catch {
    return '<p style="color:#ff6b6b">خطأ في تحليل المعادلات الرياضية</p>';
  }
}
