import type MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';

export type Language = 'en' | 'ar';

export interface BlockLabels {
  en: string;
  ar: string;
}

export interface BlockTypeConfig {
  type: string;
  labels: BlockLabels;
  numbered: boolean;
}

export interface BlockInfo {
  id: string;
  type: string;
  number: number;
  label?: string;
}

const registry = new Map<string, BlockTypeConfig>();
const counters = new Map<string, number>();
const blockInfos: BlockInfo[] = [];
let currentLang: Language = 'en';
const arabicAliases = new Map<string, string>();

export function defineBlock(config: BlockTypeConfig): void {
  registry.set(config.type, config);
  counters.set(config.type, 0);
}

export function defineBlocks(configs: BlockTypeConfig[]): void {
  for (const config of configs) {
    defineBlock(config);
  }
}

export function setLanguage(lang: Language): void {
  currentLang = lang;
}

export function getLanguage(): Language {
  return currentLang;
}

export function getBlockConfig(type: string): BlockTypeConfig | undefined {
  return registry.get(type);
}

export function getBlockConfigs(): BlockTypeConfig[] {
  return Array.from(registry.values());
}

export function getRegisteredTypes(): string[] {
  return Array.from(registry.keys());
}

export function resetBlockState(): void {
  for (const key of counters.keys()) {
    counters.set(key, 0);
  }
  blockInfos.length = 0;
}

export function getBlockInfos(): BlockInfo[] {
  return blockInfos;
}

defineBlocks([
  { type: 'theorem', labels: { en: 'Theorem', ar: 'نظرية' }, numbered: true },
  { type: 'definition', labels: { en: 'Definition', ar: 'تعريف' }, numbered: true },
  { type: 'lemma', labels: { en: 'Lemma', ar: 'تمهيدية' }, numbered: true },
  { type: 'corollary', labels: { en: 'Corollary', ar: 'نتيجة' }, numbered: true },
  { type: 'example', labels: { en: 'Example', ar: 'مثال' }, numbered: true },
  { type: 'warning', labels: { en: 'Warning', ar: 'تحذير' }, numbered: false },
  { type: 'note', labels: { en: 'Note', ar: 'ملاحظة' }, numbered: false },
  { type: 'exercise', labels: { en: 'Exercise', ar: 'تمرين' }, numbered: true },
]);

function buildAliasMap(): void {
  arabicAliases.clear();
  for (const [type, config] of registry) {
    arabicAliases.set(config.labels.ar, type);
  }
}

export function academicBlocksPlugin(md: MarkdownIt): void {
  buildAliasMap();

  md.use(container, 'academic', {
    validate: () => true,
    render(tokens: any, idx: number, _options: any, _env: any, _self: any): string {
      const token = tokens[idx];
      const info: string = token.info.trim();

      // First word is the block type, rest is title/label content
      const spaceIdx = info.indexOf(' ');
      const rawType = spaceIdx >= 0 ? info.slice(0, spaceIdx) : info;
      const rest = spaceIdx >= 0 ? info.slice(spaceIdx + 1).trim() : '';

      // Map Arabic alias to canonical type
      const canonicalType = arabicAliases.get(rawType) || rawType;
      const isArabic = arabicAliases.has(rawType);
      const config = registry.get(canonicalType);

      if (token.nesting === 1) {
        const num = (counters.get(canonicalType) || 0) + 1;
        counters.set(canonicalType, num);

        let label: string | undefined;
        let title: string;
        const labelMatch = rest.match(/^\{#([a-zA-Z0-9_-]+)\}\s*(.*)$/);
        if (labelMatch) {
          label = labelMatch[1];
          title = labelMatch[2];
        } else {
          title = rest;
        }

        const id = label || `${canonicalType}-${num}`;
        blockInfos.push({ id, type: canonicalType, number: num, label });

        let labelText: string;
        let numbered: boolean;
        let dir: string;

        if (config) {
          const lang = isArabic ? 'ar' : currentLang;
          labelText = config.labels[lang];
          numbered = config.numbered;
          dir = isArabic ? 'rtl' : 'auto';
        } else {
          labelText = rawType;
          numbered = true;
          dir = 'auto';
        }

        const labelHtml = numbered ? `${labelText} ${num}` : labelText;
        const titleHtml = title ? md.utils.escapeHtml(title) : '';
        const titleAttr = titleHtml ? ` <span class="block-title">${titleHtml}</span>` : '';

        return `<figure class="academic-block ${canonicalType}" id="${id}" dir="${dir}">\n<details>\n<summary><span class="block-label">${labelHtml}</span>${titleAttr}</summary>\n`;
      }

      return `</details>\n</figure>\n`;
    },
  });
}

export function registerCustomBlock(config: BlockTypeConfig): void {
  if (registry.has(config.type)) return;
  defineBlock(config);
  if (config.labels.ar !== config.type) {
    arabicAliases.set(config.labels.ar, config.type);
  }
}

export function injectBlockStyle(type: string, color: string): void {
  const key = `__ab_${type}`;
  const existing = document.getElementById(key);
  if (existing) existing.remove();
  const style = document.createElement('style');
  style.id = key;
  style.textContent =
    `.preview .academic-block.${type}{border-color:${color}!important}` +
    `.preview .academic-block.${type} .block-label{color:${color}!important}`;
  document.head.appendChild(style);
}

export function resolveBlockRefs(html: string): string {
  if (blockInfos.length === 0) return html;

  const refMap = new Map<string, BlockInfo>();
  for (const info of blockInfos) {
    if (info.label) refMap.set(info.label, info);
    refMap.set(info.id, info);
  }

  const types = getRegisteredTypes().join('|');
  if (!types) return html;

  const refRe = new RegExp(`\\[ref:(${types}):([^\\]]+)\\]`, 'g');
  return html.replace(refRe, (_match: string, type: string, ref: string) => {
    const config = registry.get(type);
    const info = refMap.get(ref);
    if (config && info) {
      const labelText = config.labels[currentLang];
      const display = config.numbered ? `${labelText} ${info.number}` : labelText;
      return `<a href="#${info.id}" class="block-ref">${display}</a>`;
    }
    return `<span class="block-ref-unresolved">[ref:${type}:${ref}]</span>`;
  });
}
