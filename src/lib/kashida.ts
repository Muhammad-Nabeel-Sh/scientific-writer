const TATWEEL = '\u0640';

// Letters that permit kashida insertion after them (at their connecting point)
// These are letters with a connecting form that can be stretched
const STRETCHABLE = new Set([
  'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'س', 'ش', 'ص',
  'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل',
  'م', 'ن', 'ه', 'ي', 'پ', 'چ', 'ژ', 'ڥ', 'ڤ',
]);

// Letters that NEVER accept kashida after them (isolated/final-only forms)
const NON_STRETCHABLE = new Set([
  'ا', 'د', 'ذ', 'ر', 'ز', 'و', 'ة', 'ى', 'آ', 'أ', 'إ', 'ؤ', 'ئ',
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
      const stretchPositions = countStretchablePositions(line.text);
      if (stretchPositions === 0) continue;

      const perPosition = Math.max(1, Math.floor(kashidasToAdd / stretchPositions));
      line.node.textContent = insertTatweel(line.text, perPosition);
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

function countStretchablePositions(word: string): number {
  let count = 0;
  for (let i = 0; i < word.length - 1; i++) {
    if (STRETCHABLE.has(word[i])) count++;
  }
  return count;
}

function insertTatweel(text: string, count: number): string {
  let result = '';
  let inserted = 0;

  // Process right-to-left (Arabic script direction)
  for (let i = text.length - 1; i >= 0 && inserted < count; i--) {
    result = text[i] + result;
    // Insert tatweel after stretchable chars (except at end of word)
    if (i > 0 && STRETCHABLE.has(text[i]) && !NON_STRETCHABLE.has(text[i - 1])) {
      const repetitions = i > text.length - 3 ? 1 : Math.min(2, count - inserted);
      for (let r = 0; r < repetitions && inserted < count; r++) {
        result = TATWEEL + result;
        inserted++;
      }
    }
  }

  return result;
}
