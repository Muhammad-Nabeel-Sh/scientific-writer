import type MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';
import type { RenderEnv } from './md/env';

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

export type { BlockInfo } from './md/env';

const registry = new Map<string, BlockTypeConfig>();
let currentLang: Language = 'en';
const arabicAliases = new Map<string, string>();

export function defineBlock(config: BlockTypeConfig): void {
  registry.set(config.type, config);
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

/** Container names owned by the classical-book plugin (markdown-classical.ts). */
const CLASSICAL_CONTAINERS = new Set(['matn', 'sharh', 'hashiyah', 'page']);

function splitInfo(info: string): { rawType: string; rest: string } {
  const s = info.trim();
  const sp = s.indexOf(' ');
  return sp >= 0 ? { rawType: s.slice(0, sp), rest: s.slice(sp + 1).trim() } : { rawType: s, rest: '' };
}

interface AcademicMeta {
  id: string;
  type: string;
  number: number;
  label?: string;
  title: string;
  labelText: string;
  numbered: boolean;
  dir: string;
}

/** "Theorem 2" / "ملاحظة" for a reference to a block, or null for unknown types. */
export function blockRefText(type: string, num: number): string | null {
  const config = registry.get(type);
  if (!config) return null;
  const labelText = config.labels[currentLang];
  return config.numbered ? `${labelText} ${num}` : labelText;
}

/**
 * Number academic blocks in document order and record them in `env.blocks`.
 * Runs as a core rule so numbering is known before rendering (forward refs work).
 */
function numberBlocks(state: StateCore): void {
  const env = state.env as RenderEnv;
  const counters = new Map<string, number>();
  for (const tok of state.tokens) {
    if (tok.type !== 'container_academic_open') continue;
    const { rawType, rest } = splitInfo(tok.info);
    const canonicalType = arabicAliases.get(rawType) || rawType;
    const isArabic = arabicAliases.has(rawType);
    const config = registry.get(canonicalType);
    const num = (counters.get(canonicalType) || 0) + 1;
    counters.set(canonicalType, num);

    const m = rest.match(/^\{#([a-zA-Z0-9_-]+)\}\s*(.*)$/);
    const label = m ? m[1] : undefined;
    const title = m ? m[2] : rest;
    const id = label || `${canonicalType}-${num}`;

    const meta: AcademicMeta = config
      ? {
          id, type: canonicalType, number: num, label, title,
          labelText: config.labels[isArabic ? 'ar' : currentLang],
          numbered: config.numbered,
          dir: isArabic ? 'rtl' : 'auto',
        }
      : { id, type: canonicalType, number: num, label, title, labelText: rawType, numbered: true, dir: 'auto' };
    tok.meta = { ...(tok.meta || {}), academic: meta };
    env.blocks?.push({ id, type: canonicalType, number: num, label });
  }
}

export function academicBlocksPlugin(md: MarkdownIt): void {
  buildAliasMap();

  md.use(container, 'academic', {
    validate: (params: string) => {
      const { rawType } = splitInfo(params);
      return rawType !== '' && !CLASSICAL_CONTAINERS.has(rawType);
    },
    render(tokens: any[], idx: number): string {
      const token = tokens[idx];
      if (token.nesting !== 1) return `</details>\n</figure>\n`;
      const a: AcademicMeta | undefined = token.meta?.academic;
      if (!a) return `<figure class="academic-block">\n<details open>\n<summary></summary>\n`;
      const labelHtml = a.numbered ? `${md.utils.escapeHtml(a.labelText)} ${a.number}` : md.utils.escapeHtml(a.labelText);
      const titleHtml = a.title ? ` <span class="block-title">${md.utils.escapeHtml(a.title)}</span>` : '';
      return `<figure class="academic-block ${md.utils.escapeHtml(a.type)}" id="${md.utils.escapeHtml(a.id)}" dir="${a.dir}">\n<details open>\n<summary><span class="block-label">${labelHtml}</span>${titleHtml}</summary>\n`;
    },
  });

  // Must run before cross-references are resolved (structure.ts: sw_resolve).
  md.core.ruler.before('sw_resolve', 'sw_academic_blocks', numberBlocks);
}

function buildAliasMap(): void {
  arabicAliases.clear();
  for (const [type, config] of registry) {
    arabicAliases.set(config.labels.ar, type);
  }
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
