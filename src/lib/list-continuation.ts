/**
 * Enter inside a Markdown list item starts the next item, the way most
 * Markdown editors do:
 *
 *   - item|        →  - item\n- |
 *   ١. بند|        →  ١. بند\n٢. |      (Arabic-Indic numbers stay Arabic-Indic)
 *   - [x] done|    →  - [x] done\n- [ ] |
 *   -  |  (empty)  →  |                  (Enter on an empty item ends the list)
 *
 * Pure function so it can be unit-tested; Editor.svelte applies the result.
 */

export interface TextEdit {
  value: string;
  cursor: number;
}

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EXT_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹';

// indent, marker (bullet or number + . or ) — Arabic-Indic digits too), spacing, optional task box
const ITEM_RE = /^([ \t]*(?:>[ \t]?)*)([-*+]|[0-9]+[.)]|[٠-٩]+[.)]|[۰-۹]+[.)])([ \t]+)(\[[ xX]\][ \t]+)?/;

function toWestern(digits: string): number {
  return Number(
    digits.replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d))).replace(/[۰-۹]/g, (d) => String(EXT_ARABIC_INDIC.indexOf(d))),
  );
}

function nextMarker(marker: string): string {
  const m = /^([0-9]+|[٠-٩]+|[۰-۹]+)([.)])$/.exec(marker);
  if (!m) return marker;
  const n = String(toWestern(m[1]) + 1);
  const first = m[1][0];
  const digits = ARABIC_INDIC.includes(first) ? ARABIC_INDIC : EXT_ARABIC_INDIC.includes(first) ? EXT_ARABIC_INDIC : null;
  return (digits ? n.replace(/[0-9]/g, (d) => digits[+d]) : n) + m[2];
}

/** Is `pos` inside a fenced code block (``` or ~~~)? */
function inCodeFence(value: string, pos: number): boolean {
  let open: string | null = null;
  for (const line of value.slice(0, pos).split('\n').slice(0, -1)) {
    const f = /^[ \t]*(`{3,}|~{3,})/.exec(line);
    if (!f) continue;
    if (!open) open = f[1][0];
    else if (f[1][0] === open) open = null;
  }
  return open !== null;
}

/**
 * The edit for Enter at `start`..`end`, or null when the caret is not in a
 * list item (the editor then inserts a plain newline).
 */
export function continueList(value: string, start: number, end: number): TextEdit | null {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEndIdx = value.indexOf('\n', start);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
  const line = value.slice(lineStart, lineEnd);
  const m = ITEM_RE.exec(line);
  if (!m) return null;
  const prefixLen = m[0].length;
  // Caret inside the marker itself: behave like a normal newline.
  if (start - lineStart < prefixLen) return null;
  if (inCodeFence(value, lineStart)) return null;

  const [, indent, marker, spacing, task] = m;
  const itemText = line.slice(prefixLen);
  if (itemText.trim() === '' && end <= lineEnd) {
    // Empty item: end the list (remove the marker, keep any blockquote prefix).
    const quote = indent.replace(/[^>]/g, '').replace(/>/g, '> ');
    return { value: value.slice(0, lineStart) + quote + value.slice(lineEnd), cursor: lineStart + quote.length };
  }

  const prefix = indent + nextMarker(marker) + spacing + (task ? '[ ] ' : '');
  const insert = '\n' + prefix;
  return { value: value.slice(0, start) + insert + value.slice(end), cursor: start + insert.length };
}
