import type MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';

export type TheoremType = 'theorem' | 'definition' | 'lemma' | 'corollary';

export interface TheoremLabels {
  theorem: string;
  definition: string;
  lemma: string;
  corollary: string;
}

export interface TheoremInfo {
  id: string;
  type: TheoremType;
  number: number;
  label?: string;
}

const DEFAULT_LABELS: TheoremLabels = {
  theorem: 'Theorem',
  definition: 'Definition',
  lemma: 'Lemma',
  corollary: 'Corollary',
};

let labels: TheoremLabels = { ...DEFAULT_LABELS };
let counters: Record<TheoremType, number> = { theorem: 0, definition: 0, lemma: 0, corollary: 0 };
const theoremInfos: TheoremInfo[] = [];

export function setTheoremLabels(newLabels: Partial<TheoremLabels>): void {
  labels = { ...labels, ...newLabels };
}

export function getTheoremLabels(): TheoremLabels {
  return { ...labels };
}

export function resetTheoremState(): void {
  counters = { theorem: 0, definition: 0, lemma: 0, corollary: 0 };
  theoremInfos.length = 0;
}

export function getTheoremInfos(): TheoremInfo[] {
  return theoremInfos;
}

const THEOREM_TYPES: TheoremType[] = ['theorem', 'definition', 'lemma', 'corollary'];

export function theoremPlugin(md: MarkdownIt): void {
  for (const type of THEOREM_TYPES) {
    md.use(container, type, {
      render(tokens: any, idx: number, _options: any, _env: any, _self: any): string {
        const token = tokens[idx];
        // token.info includes the container name as the first word;
        // strip it, leaving only the optional {#label} and title.
        const info: string = token.info.trim().replace(/^\S+\s*/, '');

        if (token.nesting === 1) {
          counters[type]++;
          const num = counters[type];

          let label: string | undefined;
          let title: string;
          const labelMatch = info.match(/^\{#([a-zA-Z0-9_-]+)\}\s*(.*)$/);
          if (labelMatch) {
            label = labelMatch[1];
            title = labelMatch[2];
          } else {
            title = info;
          }

          const id = label || `${type}-${num}`;
          theoremInfos.push({ id, type, number: num, label });

          const titleHtml = title ? md.utils.escapeHtml(title) : '';
          const labelHtml = `${labels[type]} ${num}`;
          const titleAttr = titleHtml ? ` <span class="theorem-title">${titleHtml}</span>` : '';

          return `<figure class="theorem-block ${type}" id="${id}">\n<details>\n<summary><span class="theorem-label">${labelHtml}</span>${titleAttr}</summary>\n`;
        }

        return `</details>\n</figure>\n`;
      },
    });
  }
}
