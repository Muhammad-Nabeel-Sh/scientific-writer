/**
 * Data for the Arabic symbols gallery in the equation dialog: registry
 * symbols (Arabic functions, the Arabic math alphabet by variant, the user's
 * own symbols) plus ready-made Arabic notation templates.
 */
import { normalizeArabic } from '../search';
import { getSymbols, getSymbolSource, type MathSymbol } from './registry';
import {
  arabicLetterVariant,
  ARABIC_SIGNS,
  MIRRORED_OPERATORS,
  NUMBER_SETS,
  type ArabicLetterVariant,
} from './symbols';

/** Nicer previews than the bare macro, for symbols that take limits or arguments. */
const PREVIEWS: Record<string, string> = {
  nihaya: '\\nihaya_{س \\to 0}',
  majmu: '\\majmu_{ن=1}^{ك}',
  rsum: '\\rsum_{ن=1}^{ك}',
  rint: '\\rint_{0}^{1}',
  riint: '\\riint',
  riiint: '\\riiint',
  roint: '\\roint',
  roiint: '\\roiint',
  rsqrt: '\\rsqrt{س}',
  rroot: '\\rroot{3}{س}',
  arCubeRoot: '\\arCubeRoot س',
  arFourthRoot: '\\arFourthRoot س',
  arPercent: '50\\arPercent',
};

/** What gets inserted for symbols with arguments: the user fills the braces. */
const INSERTS: Record<string, string> = {
  rsqrt: '\\rsqrt{}',
  rroot: '\\rroot{3}{}',
};

export interface GalleryItem {
  id: string;
  /** Arabic label shown under / on hover. */
  label: string;
  /** TeX inserted into the equation input. */
  insert: string;
  /** TeX rendered as the button's preview. */
  preview: string;
  keywords: string[];
}

export interface GalleryGroup {
  id: string;
  label: string;
  items: GalleryItem[];
  /** Shown expanded when the gallery opens. */
  open?: boolean;
}

/** Common Arabic notation, ready to adapt. */
export const ARABIC_TEMPLATES: GalleryItem[] = [
  t('tpl-func', 'دالة', 'د(س) = س^2 + 1', ['دالة', 'function']),
  t('tpl-limit', 'نهاية', '\\nihaya_{س \\to 0} د(س)', ['نهاية', 'نها', 'limit']),
  t('tpl-limit-inf', 'نهاية عند اللانهاية', '\\nihaya_{س \\to \\infty} \\frac{1}{س}', ['نهاية', 'لانهاية', 'infinity']),
  t('tpl-sum', 'مجموع', '\\sum_{ن=1}^{ك} أ_{ن}', ['مجموع', 'sum', 'سلسلة']),
  t('tpl-int', 'تكامل محدد', '\\int_{أ}^{ب} د(س) \\, ءس', ['تكامل', 'integral']),
  t('tpl-deriv', 'مشتقة', '\\frac{ءص}{ءس}', ['مشتقة', 'اشتقاق', 'derivative']),
  t('tpl-text-frac', 'كسر بكلمات', '\\frac{\\text{المسافة}}{\\text{الزمن}}', ['كسر', 'نص', 'fraction']),
  t('tpl-law', 'قانون', '\\text{السرعة} = \\frac{\\text{المسافة}}{\\text{الزمن}}', ['قانون', 'law']),
  t('tpl-vector', 'متجه', '\\overrightarrow{أب}', ['متجه', 'vector']),
  t('tpl-trig', 'متطابقة مثلثية', '\\jaa^2 س + \\jataa^2 س = 1', ['جا', 'جتا', 'مثلثية', 'identity']),
  t('tpl-cases', 'دالة متعددة القواعد', 'د(س) = \\begin{cases} س & س \\geq 0 \\\\ -س & س < 0 \\end{cases}', ['قواعد', 'cases', 'متعددة']),
  t('tpl-matrix', 'مصفوفة', '\\begin{pmatrix} أ & ب \\\\ ج & د \\end{pmatrix}', ['مصفوفة', 'matrix']),
  t('tpl-set', 'مجموعة', 'ص = \\{ س : س \\in \\mathbb{R} ، س > 0 \\}', ['مجموعة', 'set']),
];

function t(id: string, label: string, tex: string, keywords: string[]): GalleryItem {
  return { id, label, insert: tex, preview: tex, keywords };
}

const VARIANT_GROUPS: { variant: ArabicLetterVariant; label: string }[] = [
  { variant: 'isolated', label: 'الحروف الرياضية' },
  { variant: 'initial', label: 'حروف مستهلّة' },
  { variant: 'tailed', label: 'حروف بذيل' },
  { variant: 'stretched', label: 'حروف ممدودة' },
  { variant: 'looped', label: 'حروف معقودة' },
  { variant: 'double-struck', label: 'حروف مزدوجة' },
  { variant: 'dotless', label: 'حروف بلا نقط' },
  { variant: 'operator', label: 'مؤثرات عربية' },
];

/** Insert / preview TeX for one registry symbol. */
export function symbolItem(sym: MathSymbol): GalleryItem {
  const call = `\\${sym.name}` + '{س}'.repeat(sym.arity ?? 0);
  const preview = PREVIEWS[sym.name] ?? (sym.category === 'arabic-function' ? `${call} س` : call);
  return {
    id: `sym-${sym.name}`,
    label: sym.labelAr,
    // trailing space: "\jaa س" must not become "\jaaس"
    insert: INSERTS[sym.name] ?? ((sym.arity ?? 0) > 0 ? call : `${call} `),
    preview,
    keywords: [sym.name, ...sym.keywords],
  };
}

export function arabicGalleryGroups(symbols: MathSymbol[] = getSymbols()): GalleryGroup[] {
  const groups: GalleryGroup[] = [
    { id: 'templates', label: 'قوالب عربية', items: ARABIC_TEMPLATES, open: true },
  ];
  const user = symbols.filter((s) => getSymbolSource(s.name) === 'user');
  const builtin = symbols.filter((s) => getSymbolSource(s.name) !== 'user');

  const functions = builtin.filter((s) => s.category === 'arabic-function');
  if (functions.length) groups.push({ id: 'functions', label: 'الدوال العربية', items: functions.map(symbolItem), open: true });

  // Named built-in sets, in this order, before the alphabet.
  const named: { id: string; label: string; set: MathSymbol[]; open?: boolean }[] = [
    { id: 'mirrored', label: 'رموز معكوسة (∑ ∫ √ …)', set: MIRRORED_OPERATORS, open: true },
    { id: 'number-sets', label: 'مجموعات الأعداد', set: NUMBER_SETS },
    { id: 'signs', label: 'علامات عربية (؆ ؇ ؈ ٪ ؉)', set: ARABIC_SIGNS },
  ];
  const inNamed = new Set<string>();
  for (const { id, label, set, open } of named) {
    const names = new Set(set.map((s) => s.name));
    const items = builtin.filter((s) => names.has(s.name));
    items.forEach((s) => inNamed.add(s.name));
    if (items.length) groups.push({ id, label, items: items.map(symbolItem), open });
  }

  const letters = builtin.filter((s) => s.category === 'arabic-letter');
  for (const { variant, label } of VARIANT_GROUPS) {
    const items = letters.filter((s) => arabicLetterVariant(s.name) === variant).map(symbolItem);
    if (items.length) groups.push({ id: `letters-${variant}`, label, items, open: variant === 'isolated' });
  }

  const others = builtin.filter(
    (s) => s.category !== 'arabic-function' && s.category !== 'arabic-letter' && !inNamed.has(s.name),
  );
  if (others.length) groups.push({ id: 'others', label: 'رموز أخرى', items: others.map(symbolItem) });
  if (user.length) groups.push({ id: 'user', label: 'رموزي المخصصة', items: user.map(symbolItem), open: true });
  return groups;
}

/** Keep only items matching the query (name, Arabic label, keywords); diacritic-insensitive. */
export function filterGallery(groups: GalleryGroup[], query: string): GalleryGroup[] {
  const q = normalizeArabic(query.trim().toLowerCase().replace(/^\\/, ''));
  if (!q) return groups;
  return groups
    .map((g) => ({
      ...g,
      open: true,
      items: g.items.filter((it) =>
        [it.label, it.insert, ...it.keywords].some((s) => normalizeArabic(s.toLowerCase()).includes(q)),
      ),
    }))
    .filter((g) => g.items.length > 0);
}
