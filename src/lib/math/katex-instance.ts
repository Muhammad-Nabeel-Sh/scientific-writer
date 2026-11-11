/**
 * The app's only KaTeX entry point. Every math render (preview, equation
 * dialog, gallery, symbol editor) goes through `renderMath`, so macros from
 * the symbol registry, the trust policy and the warning handling are the
 * same everywhere.
 *
 * Do not import 'katex' anywhere else.
 */
import katex from 'katex';

export type MathDir = 'ltr' | 'rtl';

export type MathIssueCode =
  | 'undefined-macro' // \foo is not a KaTeX command or registered symbol
  | 'parse' // any other KaTeX parse error
  | 'strict'; // KaTeX "strict" warning (LaTeX-incompatible input)

export interface MathIssue {
  code: MathIssueCode;
  message: string;
  /** For 'undefined-macro': the macro name without backslash. */
  macro?: string;
}

export interface MathRenderOptions {
  display: boolean;
  /**
   * 'rtl' renders MathML only with `dir="rtl"` (Arabic notation, laid out by
   * the WebView's MathML engine). Experimental — see docs/rtl-math-spike.md.
   */
  dir?: MathDir;
  /** Digits in right-to-left math. Default 'arabic-indic' (Mashriq); 'western' for Maghrib. */
  digits?: 'arabic-indic' | 'western';
  onIssue?: (issue: MathIssue) => void;
}

/** Arabic script (incl. supplements, presentation forms, Arabic math alphabet) and Arabic-Indic digits. */
const ARABIC_CHAR_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u{1EE00}-\u{1EEFF}]/u;
const NO_METRICS_RE = /^No character metrics for /;
const UNDEFINED_RE = /Undefined control sequence: \\([A-Za-z@]+)/;

let macros: Record<string, string> = {};

/** Replace the macro table (called by the symbol registry whenever it changes). */
export function setMathMacros(next: Record<string, string>): void {
  macros = { ...next };
}

export function getMathMacros(): Readonly<Record<string, string>> {
  return macros;
}

/**
 * Only `\htmlClass` with app-owned classes (`sw-…`) is trusted: glyph symbols
 * use it to select a bundled font. Nothing else (\href, \url, \htmlStyle,
 * \htmlId, \includegraphics …) is allowed.
 */
function trust(ctx: { command: string; class?: string }): boolean {
  if (ctx.command !== '\\htmlClass' || !ctx.class) return false;
  return ctx.class.split(/\s+/).every((c) => /^sw-[a-z0-9-]+$/.test(c));
}

function strictHandler(onIssue?: (i: MathIssue) => void) {
  return (code: string, message: string) => {
    // Glyph symbols use \htmlClass by design (trust-limited to sw- classes).
    if (code === 'htmlExtension') return 'ignore' as const;
    if (code === 'unknownSymbol' || code === 'unicodeTextInMathMode') {
      // Arabic letters/digits in math are intended in this app.
      const ch = /"(.)"/u.exec(message)?.[1] ?? '';
      // KaTeX inspects UTF-16 units, so U+1EE00–1EEFF (Arabic math alphabet)
      // is reported as its surrogates: high \uD83B, low \uDE00–\uDEFF.
      if (ARABIC_CHAR_RE.test(ch) || /^[𞸀-\uDEFF]$/.test(ch)) return 'ignore' as const;
    }
    onIssue?.({ code: 'strict', message: `${code}: ${message}` });
    return 'ignore' as const;
  };
}

/** KaTeX prints "No character metrics" straight to the console for Arabic letters; swallow only those. */
function withQuietMetrics<T>(fn: () => T): T {
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && NO_METRICS_RE.test(args[0])) return;
    original.apply(console, args as []);
  };
  try {
    return fn();
  } finally {
    console.warn = original;
  }
}

function toIssue(e: unknown): MathIssue {
  const message = e instanceof Error ? e.message : String(e);
  const m = UNDEFINED_RE.exec(message);
  return m ? { code: 'undefined-macro', message, macro: m[1] } : { code: 'parse', message };
}

export function renderMath(tex: string, opts: MathRenderOptions): string {
  const rtl = opts.dir === 'rtl';
  const base = {
    displayMode: opts.display,
    output: rtl ? ('mathml' as const) : ('htmlAndMathml' as const),
    strict: strictHandler(opts.onIssue),
    trust,
    // KaTeX mutates `macros` for \gdef; give each render its own copy.
    macros: { ...macros },
  };
  const html = withQuietMetrics(() => {
    try {
      return katex.renderToString(tex, { ...base, throwOnError: true });
    } catch (e) {
      opts.onIssue?.(toIssue(e));
      return katex.renderToString(tex, { ...base, macros: { ...macros }, throwOnError: false });
    }
  });
  const fixed = unwrapTokenText(html);
  return rtl ? toRtlMathml(fixed, opts.digits ?? 'arabic-indic') : isolateArabicRuns(fixed);
}

/**
 * Glyph symbols are \mathord{\htmlClass{…}{\text{X}}}, and KaTeX writes their
 * MathML as <mi><mtext>X</mtext></mi>. A token element must contain only
 * text (MathML Core), and Chromium draws nothing for it, so the symbol
 * vanished in right-to-left (MathML-only) equations. Unwrap to <mi>X</mi>.
 * `mathvariant="normal"` keeps a single-character <mi> upright.
 */
export function unwrapTokenText(html: string): string {
  return html.replace(
    /<(mi|mo|mn)((?:\s[^>]*)?)><mtext>([^<]*)<\/mtext><\/\1>/g,
    (_m, tag: string, attrs: string, text: string) =>
      tag === 'mi' && !/mathvariant=/.test(attrs)
        ? `<mi${attrs} mathvariant="normal">${text}</mi>`
        : `<${tag}${attrs}>${text}</${tag}>`,
  );
}

const ARABIC_CLASS =
  '\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF\\u{1EE00}-\\u{1EEFF}';
/** A run of Arabic, possibly with spaces/ZWJ/ZWNJ between Arabic characters. */
const ARABIC_RUN_RE = new RegExp(`[${ARABIC_CLASS}](?:[${ARABIC_CLASS}\\u0020\\u00A0\\u200C\\u200D]*[${ARABIC_CLASS}])?`, 'gu');
const KATEX_HTML_MARK = '<span class="katex-html"';

/**
 * Left-to-right formulas: keep atoms in TeX order (M14).
 *
 * KaTeX emits each atom as a plain span. The browser's bidi algorithm then
 * reorders runs like "س → 0" (an Arabic letter, a neutral operator, a
 * number), so `\nihaya_{س \to 0}` displayed as "0→ س". CSS forces the
 * HTML layer's atoms into DOM order (`bidi-override`, see app.css). This
 * wraps every Arabic run in an RTL isolate, so the letters of a word keep
 * their natural order and joining inside it. Only the visible HTML layer is
 * touched; the MathML layer (and its TeX annotation) is left alone.
 */
export function isolateArabicRuns(html: string): string {
  const at = html.indexOf(KATEX_HTML_MARK);
  if (at === -1) return html;
  const visible = html.slice(at).replace(/>([^<]+)</g, (m, text: string) => {
    if (!ARABIC_RUN_RE.test(text)) return m;
    ARABIC_RUN_RE.lastIndex = 0;
    return '>' + text.replace(ARABIC_RUN_RE, (run) => `<span class="sw-ar" dir="rtl">${run}</span>`) + '<';
  });
  return html.slice(0, at) + visible;
}

/**
 * Arrows have no Unicode mirroring, and the 'rtlm' font feature does not cover
 * them, but Arabic notation writes them pointing the other way (س ← ٠).
 */
const RTL_ARROWS: Record<string, string> = {
  '→': '←', '←': '→', '⟶': '⟵', '⟵': '⟶', '⇒': '⇐', '⇐': '⇒', '⟹': '⟸', '⟸': '⟹',
  '↦': '↤', '↤': '↦', '⟼': '⟻', '↪': '↩', '↩': '↪', '⇀': '↼', '↼': '⇀', '⇁': '↽', '↽': '⇁',
};
const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';

/** Post-process KaTeX MathML for right-to-left Arabic notation (M7, experimental). */
function toRtlMathml(html: string, digits: 'arabic-indic' | 'western'): string {
  let out = html
    .replace('<math ', '<math dir="rtl" ')
    .replace('class="katex"', 'class="katex sw-math-rtl"')
    // operators: mirror arrows
    .replace(/(<mo\b[^>]*>)([^<]+)(<\/mo>)/g, (_m, open: string, op: string, close: string) =>
      open + (RTL_ARROWS[op] ?? op) + close)
    // function application (after \operatorname, e.g. جا س) gets no space in
    // MathML; add a thin space so the name does not join its argument.
    .replace(/<mo>⁡<\/mo>/g, '<mo>⁡</mo><mspace width="0.1667em"></mspace>');
  if (digits === 'arabic-indic') {
    out = out.replace(/(<mn\b[^>]*>)([^<]+)(<\/mn>)/g, (_m, open: string, n: string, close: string) =>
      open + n.replace(/[0-9]/g, (d) => ARABIC_INDIC[+d]).replace(/\./g, '٫') + close);
  }
  return out;
}

/**
 * Whether `\name` is already a KaTeX command or macro (ignoring registry
 * macros). Used to stop custom symbols from silently shadowing built-ins.
 */
export function isKatexCommand(name: string): boolean {
  try {
    withQuietMetrics(() => katex.renderToString(`\\${name}`, { throwOnError: true, strict: 'ignore' }));
    return true;
  } catch (e) {
    return !UNDEFINED_RE.test(e instanceof Error ? e.message : String(e));
  }
}
