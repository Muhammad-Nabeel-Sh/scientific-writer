/**
 * Minimal YAML front-matter reader.
 *
 * Supports the flat `key: value` metadata the app needs (`lang`, `direction`,
 * `title`, `author`, `date`, …). Nested YAML is intentionally not parsed.
 */
export interface FrontMatterResult {
  meta: Record<string, string>;
  body: string;
  /** Lines removed before `body` starts; add it to body-relative line numbers. */
  bodyLineOffset: number;
  hasFrontMatter: boolean;
}

export function parseFrontMatter(text: string): FrontMatterResult {
  const normalized = text.startsWith('\uFEFF') ? text.slice(1) : text;
  const lines = normalized.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    return { meta: {}, body: text, bodyLineOffset: 0, hasFrontMatter: false };
  }

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { meta: {}, body: text, bodyLineOffset: 0, hasFrontMatter: false };
  }

  const meta: Record<string, string> = {};
  let metaLines = 0;
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    if (!key) continue;
    metaLines++;
    let value = line.slice(colon + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }

  // `---` is also a horizontal rule: only strip the block when it holds metadata.
  if (metaLines === 0) {
    return { meta: {}, body: text, bodyLineOffset: 0, hasFrontMatter: false };
  }

  const afterHeader = lines.slice(end + 1).join('\n');
  const body = afterHeader.replace(/^\n+/, '');
  return {
    meta,
    body,
    bodyLineOffset: end + 1 + (afterHeader.length - body.length),
    hasFrontMatter: true,
  };
}

export function frontMatterLanguage(meta: Record<string, string>): 'ar' | 'en' | undefined {
  return meta.lang === 'ar' || meta.lang === 'en' ? meta.lang : undefined;
}
