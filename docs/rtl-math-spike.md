# Right-to-left Arabic math — spike (M7)

Date: 2026-11-11 · Verdict: **GO for the preview (behind a flag); export still open.**

## What was tried

- **Syntax.** `$$[rtl] … $$` (also `\[[rtl] … \]`) makes a single equation
  right-to-left. `RenderOptions.mathDir: 'rtl'` makes it the document default,
  and `$$[ltr]` overrides that for one equation. A front-matter switch belongs
  to L4.
- **Rendering.** `renderMath(tex, { dir: 'rtl' })` (`src/lib/math/katex-instance.ts`)
  asks KaTeX for **MathML only**, sets `dir="rtl"` on `<math>`, and leaves the
  layout to the WebView's MathML Core engine. That engine is Chromium, the same
  as WebView2. The HTML+CSS output that KaTeX normally uses cannot be reversed
  safely.
- **Post-processing for Arabic notation** (`toRtlMathml`):
  - Arrows are swapped (`→`↔`←`, `⇒`↔`⇐`, `↦`↔`↤` …). They have no Unicode
    mirroring and `rtlm` does not cover them, but Arabic textbooks write
    `س ← ٠`.
  - `<mn>` digits become Arabic-Indic, and `.` becomes `٫`, unless the
    document's digit style is `western` (Maghrib).
  - A thin space follows the function-application operator, so that `جا س`
    does not run together as `جاس`.
- **Fonts.** `math, 'Cambria Math', 'Amiri', serif`; see
  [math-fonts.md](math-fonts.md).

## Evidence (measured in the running app, Chromium)

Layout was checked from the DOM. In every `dir="rtl"` formula, the children of
the top-level `<mrow>` have decreasing x positions, so they are laid out right
to left. The LTR control formula increases.

Screenshots (`docs/images/math/`):

| File | Shows |
|---|---|
| `rtl-amiri-first.jpg` | First attempt (Amiri first): order is correct, but **√ is not drawn** and arrows are not mirrored. |
| `rtl-mathfont-first.png` | System math font first: ∑ and √ are **mirrored** by `rtlm`, parentheses mirror, `≤` is shown mirrored. Arrows and digits are still Western. |
| `rtl-final.png` | With post-processing: `س ← ٠`, Arabic-Indic digits (`٢٫٥`), `⇐`, `جا س` spaced. |

Test coverage: `src/lib/__tests__/math-syntax.test.ts`, section "M7 RTL prototype".

## Works

- Order of operands and operators. Sub- and superscripts sit on the correct
  side (`ن²` has the 2 on the left). Under- and over-limits for ∑ and نها.
  Fractions.
- Mirrored ∑ and √, and paired delimiters (via `rtlm` in Cambria Math).
- Arabic letters, Arabic function names (`\jaa`, `\nihaya`) and registry macros.
- Sanitisation keeps `<math dir="rtl">`.

## Known gaps

1. **OS-dependent operator font.** Mirroring comes from the system math font
   (Cambria Math on Windows). Untested on macOS/Linux. This is fixed by
   bundling a math font with `rtlm` (XITS Math); see math-fonts.md, follow-up.
2. **No visual comparison against a textbook yet.** The acceptance criterion in
   §B.4 (about 20 formulas from an Arabic school book) still needs that
   reference material. Someone with the book should do it.
3. **MathML only.** There is no KaTeX HTML layer, so spacing follows Chromium's
   operator dictionary rather than KaTeX's rules. Slight differences from LTR
   output are expected.
4. **Arrow mirroring is semantic,** not glyph-level: `→` becomes `←` in the
   MathML. Copied text and exports from the AST still carry the TeX source with
   `\to`.
5. **Export** (stage 3) is not done. LaTeX has no mainstream RTL math. Options
   to evaluate in Phase 4:
   - XeLaTeX + `bidi`'s RTL math support
   - LuaLaTeX with a math font that has `rtlm`
   - for Typst and DOCX, exporting RTL equations as LTR with a warning
6. Inline RTL math only works through the document-level `mathDir` (there is no
   `$[rtl]` inline syntax). That is intentional: inline formulas in Arabic prose
   are usually short.

## Recommendation

Keep `[rtl]` as an **opt-in, documented as experimental** feature. Bundle XITS
Math when it can be verified, then run the textbook comparison. Don't make RTL
the default until both are done.
