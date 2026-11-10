const TATWEEL = '\u0640';

// Letters that permit kashida insertion after them (at their connecting point)
// These are letters with a connecting form that can be stretched
const STRETCHABLE = new Set([
  'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'س', 'ش', 'ص',
  'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل',
  'م', 'ن', 'ه', 'ي', 'پ', 'چ', 'ژ', 'ڥ', 'ڤ',
]);

export interface KashidaConfig {
  enabled: boolean;
  targetFill: number; // 0-1, e.g. 0.92 = apply kashida only if line fills ≥92% of container
}

/**
 * Apply kashida justification to all block-level children of `root`.
 * Idempotent — clears previous tatweel before re-applying.
 */
export function applyKashida(root: HTMLElement, config: KashidaConfig): void {
  if (!config.enabled) return;

  const blocks = root.querySelectorAll<HTMLElement>('p, li, h1, h2, h3, h4, blockquote');
  for (const block of blocks) {
    kashidaJustifyBlock(block, config.targetFill);
  }
}

/**
 * Remove all tatweel chars from the given root element.
 */
export function clearKashida(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (node.textContent?.includes(TATWEEL)) {
      node.textContent = node.textContent.replace(new RegExp(TATWEEL, 'g'), '');
    }
  }
}

function kashidaJustifyBlock(block: HTMLElement, targetFill: number): void {
  // Clear previous tatweel from this block
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
  const textNodes: Text[] = [];
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (node.textContent?.includes(TATWEEL)) {
      node.textContent = node.textContent.replace(new RegExp(TATWEEL, 'g'), '');
    }
    textNodes.push(node);
  }

  const blockWidth = block.offsetWidth;
  if (blockWidth === 0) return;

  // Measure each visual line via Range
  const lines = getVisualLines(block);
  for (const line of lines) {
    const fillRatio = line.width / blockWidth;
    if (fillRatio >= targetFill && fillRatio < 0.98) {
      const gap = blockWidth - line.width;
      const kashidasToAdd = Math.max(1, Math.round(gap / 8));
      if (countStretchablePositions(line.text) === 0) continue;

      line.node.textContent = insertTatweel(line.text, kashidasToAdd);
    }
  }
}

interface VisualLine {
  text: string;
  width: number;
  y: number;
  node: Text;
}

function getVisualLines(block: HTMLElement): VisualLine[] {
  const lines: VisualLine[] = [];
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent || '';
    if (!text.trim()) continue;

    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = range.getClientRects();

    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      const existing = lines.find(l => Math.abs(l.y - rect.top) < 2);
      if (existing) {
        existing.width += rect.width;
      } else {
        lines.push({ text, width: rect.width, y: rect.top, node });
      }
    }
  }
  return lines;
}

const ARABIC_LETTER = /[\u0621-\u064A\u066E-\u06D3\u06FA-\u06FC]/;

function isJoinableLetter(ch: string): boolean {
  return ch !== 'ء' && ARABIC_LETTER.test(ch);
}

function isLamAlef(text: string, i: number): boolean {
  return text[i] === 'ل' && 'اأإآ'.includes(text[i + 1]);
}

/** A kashida may be inserted after `text[i]` only if it joins the next letter. */
function isKashidaPosition(text: string, i: number): boolean {
  if (i < 0 || i >= text.length - 1) return false;
  if (!STRETCHABLE.has(text[i])) return false;
  if (!isJoinableLetter(text[i + 1])) return false;
  if (isLamAlef(text, i)) return false;
  return true;
}

export function countStretchablePositions(word: string): number {
  let count = 0;
  for (let i = 0; i < word.length - 1; i++) {
    if (isKashidaPosition(word, i)) count++;
  }
  return count;
}

export function insertTatweel(text: string, count: number): string {
  const positions: number[] = [];
  for (let i = 0; i < text.length - 1; i++) {
    if (isKashidaPosition(text, i)) positions.push(i);
  }
  if (positions.length === 0 || count <= 0) return text;

  // Distribute evenly, but never stretch a single join by more than two tatweels.
  const perPosition = Math.floor(count / positions.length);
  const remainder = count % positions.length;
  const allocation = new Map<number, number>();
  for (let j = 0; j < positions.length; j++) {
    allocation.set(positions[j], Math.min(2, perPosition + (j < remainder ? 1 : 0)));
  }

  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += text[i];
    const repetitions = allocation.get(i) ?? 0;
    if (repetitions > 0) result += TATWEEL.repeat(repetitions);
  }

  return result;
}
