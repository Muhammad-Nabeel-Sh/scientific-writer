/**
 * Turns the equation dialog's options into the Markdown that gets inserted.
 *
 *   display + ltr   →  $$ … $$ {#eq:label}
 *   display + rtl   →  $$[rtl] … $$ {#eq:label}
 *   inline          →  $…$         (no label, always LTR: there is no inline RTL syntax)
 */
export type EquationDir = 'ltr' | 'rtl';

export interface EquationOptions {
  tex: string;
  display: boolean;
  dir: EquationDir;
  label?: string;
}

const LABEL_RE = /^[^\s{}]+$/;

/** null if the label is usable, otherwise an Arabic error message. Empty = no label. */
export function labelError(label: string | undefined): string | null {
  const l = (label ?? '').trim();
  if (!l) return null;
  if (!LABEL_RE.test(l)) return 'الوسم لا يقبل المسافات أو الأقواس { }';
  return null;
}

export function buildEquationSnippet(o: EquationOptions): string {
  const tex = o.tex.trim();
  if (!tex) return '';
  if (!o.display) return `$${tex}$`;
  const label = (o.label ?? '').trim();
  const suffix = label && !labelError(label) ? ` {#eq:${label}}` : '';
  const open = o.dir === 'rtl' ? '$$[rtl]' : '$$';
  return `\n${open}\n${tex}\n$$${suffix}\n`;
}
