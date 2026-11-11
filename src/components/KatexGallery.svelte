<script lang="ts">
  import { onMount } from 'svelte';
  import { renderMath } from '$lib/math';
  import { sanitizeHtml } from '$lib/sanitize';

  export let onInsert: (latex: string) => void;

  interface GalleryItem {
    latex: string;
    preview: string;
    code: string;
  }

  interface GalleryCategory {
    name: string;
    label: string;
    items: GalleryItem[];
  }

  const galleryData: GalleryCategory[] = [
    {
      name: 'fractions',
      label: 'الكسور',
      items: [
        { latex: '\\frac{}{}', preview: '\\frac{a}{b}', code: '\\frac{a}{b}' },
        { latex: '\\dfrac{}{}', preview: '\\dfrac{a}{b}', code: '\\dfrac{a}{b}' },
        { latex: '\\tfrac{}{}', preview: '\\tfrac{a}{b}', code: '\\tfrac{a}{b}' },
        { latex: '\\cfrac{}{}', preview: '\\cfrac{a}{b}', code: '\\cfrac{a}{b}' },
        { latex: '\\binom{}{}', preview: '\\binom{n}{k}', code: '\\binom{n}{k}' },
        { latex: '\\dbinom{}{}', preview: '\\dbinom{n}{k}', code: '\\dbinom{n}{k}' },
        { latex: '\\tbinom{}{}', preview: '\\tbinom{n}{k}', code: '\\tbinom{n}{k}' },
      ],
    },
    {
      name: 'roots',
      label: 'الجذور',
      items: [
        { latex: '\\sqrt{}', preview: '\\sqrt{x}', code: '\\sqrt{x}' },
        { latex: '\\sqrt[]{}', preview: '\\sqrt[3]{x}', code: '\\sqrt[3]{x}' },
        { latex: '\\surd', preview: '\\surd', code: '\\surd' },
      ],
    },
    {
      name: 'greek-lower',
      label: 'الحروف اليونانية (صغيرة)',
      items: [
        { latex: '\\alpha', preview: '\\alpha', code: '\\alpha' },
        { latex: '\\beta', preview: '\\beta', code: '\\beta' },
        { latex: '\\gamma', preview: '\\gamma', code: '\\gamma' },
        { latex: '\\delta', preview: '\\delta', code: '\\delta' },
        { latex: '\\epsilon', preview: '\\epsilon', code: '\\epsilon' },
        { latex: '\\varepsilon', preview: '\\varepsilon', code: '\\varepsilon' },
        { latex: '\\zeta', preview: '\\zeta', code: '\\zeta' },
        { latex: '\\eta', preview: '\\eta', code: '\\eta' },
        { latex: '\\theta', preview: '\\theta', code: '\\theta' },
        { latex: '\\vartheta', preview: '\\vartheta', code: '\\vartheta' },
        { latex: '\\iota', preview: '\\iota', code: '\\iota' },
        { latex: '\\kappa', preview: '\\kappa', code: '\\kappa' },
        { latex: '\\lambda', preview: '\\lambda', code: '\\lambda' },
        { latex: '\\mu', preview: '\\mu', code: '\\mu' },
        { latex: '\\nu', preview: '\\nu', code: '\\nu' },
        { latex: '\\xi', preview: '\\xi', code: '\\xi' },
        { latex: '\\omicron', preview: '\\omicron', code: '\\omicron' },
        { latex: '\\pi', preview: '\\pi', code: '\\pi' },
        { latex: '\\varpi', preview: '\\varpi', code: '\\varpi' },
        { latex: '\\rho', preview: '\\rho', code: '\\rho' },
        { latex: '\\varrho', preview: '\\varrho', code: '\\varrho' },
        { latex: '\\sigma', preview: '\\sigma', code: '\\sigma' },
        { latex: '\\varsigma', preview: '\\varsigma', code: '\\varsigma' },
        { latex: '\\tau', preview: '\\tau', code: '\\tau' },
        { latex: '\\upsilon', preview: '\\upsilon', code: '\\upsilon' },
        { latex: '\\phi', preview: '\\phi', code: '\\phi' },
        { latex: '\\varphi', preview: '\\varphi', code: '\\varphi' },
        { latex: '\\chi', preview: '\\chi', code: '\\chi' },
        { latex: '\\psi', preview: '\\psi', code: '\\psi' },
        { latex: '\\omega', preview: '\\omega', code: '\\omega' },
      ],
    },
    {
      name: 'greek-upper',
      label: 'الحروف اليونانية (كبيرة)',
      items: [
        { latex: '\\Gamma', preview: '\\Gamma', code: '\\Gamma' },
        { latex: '\\Delta', preview: '\\Delta', code: '\\Delta' },
        { latex: '\\Theta', preview: '\\Theta', code: '\\Theta' },
        { latex: '\\Lambda', preview: '\\Lambda', code: '\\Lambda' },
        { latex: '\\Xi', preview: '\\Xi', code: '\\Xi' },
        { latex: '\\Pi', preview: '\\Pi', code: '\\Pi' },
        { latex: '\\Sigma', preview: '\\Sigma', code: '\\Sigma' },
        { latex: '\\Upsilon', preview: '\\Upsilon', code: '\\Upsilon' },
        { latex: '\\Phi', preview: '\\Phi', code: '\\Phi' },
        { latex: '\\Psi', preview: '\\Psi', code: '\\Psi' },
        { latex: '\\Omega', preview: '\\Omega', code: '\\Omega' },
      ],
    },
    {
      name: 'integrals',
      label: 'التكاملات',
      items: [
        { latex: '\\int', preview: '\\int', code: '\\int' },
        { latex: '\\int_{}^{}', preview: '\\int_{a}^{b}', code: '\\int_{a}^{b}' },
        { latex: '\\iint', preview: '\\iint', code: '\\iint' },
        { latex: '\\iiint', preview: '\\iiint', code: '\\iiint' },
        { latex: '\\idotsint', preview: '\\idotsint', code: '\\idotsint' },
        { latex: '\\oint', preview: '\\oint', code: '\\oint' },
        { latex: '\\oiint', preview: '\\oiint', code: '\\oiint' },
        { latex: '\\oiiint', preview: '\\oiiint', code: '\\oiiint' },
      ],
    },
    {
      name: 'sums',
      label: 'المجاميع والنهايات',
      items: [
        { latex: '\\sum', preview: '\\sum', code: '\\sum' },
        { latex: '\\sum_{}^{}', preview: '\\sum_{i=1}^{n}', code: '\\sum_{i=1}^{n}' },
        { latex: '\\prod', preview: '\\prod', code: '\\prod' },
        { latex: '\\coprod', preview: '\\coprod', code: '\\coprod' },
        { latex: '\\lim', preview: '\\lim', code: '\\lim' },
        { latex: '\\lim_{}', preview: '\\lim_{x \\to \\infty}', code: '\\lim_{x \\to \\infty}' },
        { latex: '\\limsup', preview: '\\limsup', code: '\\limsup' },
        { latex: '\\liminf', preview: '\\liminf', code: '\\liminf' },
        { latex: '\\sup', preview: '\\sup', code: '\\sup' },
        { latex: '\\inf', preview: '\\inf', code: '\\inf' },
        { latex: '\\max', preview: '\\max', code: '\\max' },
        { latex: '\\max_{}', preview: '\\max_{x \\in X}', code: '\\max_{x \\in X}' },
        { latex: '\\min', preview: '\\min', code: '\\min' },
        { latex: '\\arg', preview: '\\arg', code: '\\arg' },
        { latex: '\\deg', preview: '\\deg', code: '\\deg' },
      ],
    },
    {
      name: 'operators',
      label: 'العوامل الرياضية',
      items: [
        { latex: '\\sin', preview: '\\sin', code: '\\sin' },
        { latex: '\\cos', preview: '\\cos', code: '\\cos' },
        { latex: '\\tan', preview: '\\tan', code: '\\tan' },
        { latex: '\\cot', preview: '\\cot', code: '\\cot' },
        { latex: '\\sec', preview: '\\sec', code: '\\sec' },
        { latex: '\\csc', preview: '\\csc', code: '\\csc' },
        { latex: '\\arcsin', preview: '\\arcsin', code: '\\arcsin' },
        { latex: '\\arccos', preview: '\\arccos', code: '\\arccos' },
        { latex: '\\arctan', preview: '\\arctan', code: '\\arctan' },
        { latex: '\\sinh', preview: '\\sinh', code: '\\sinh' },
        { latex: '\\cosh', preview: '\\cosh', code: '\\cosh' },
        { latex: '\\tanh', preview: '\\tanh', code: '\\tanh' },
        { latex: '\\coth', preview: '\\coth', code: '\\coth' },
        { latex: '\\log', preview: '\\log', code: '\\log' },
        { latex: '\\ln', preview: '\\ln', code: '\\ln' },
        { latex: '\\lg', preview: '\\lg', code: '\\lg' },
        { latex: '\\exp', preview: '\\exp', code: '\\exp' },
        { latex: '\\det', preview: '\\det', code: '\\det' },
        { latex: '\\gcd', preview: '\\gcd', code: '\\gcd' },
        { latex: '\\hom', preview: '\\hom', code: '\\hom' },
        { latex: '\\ker', preview: '\\ker', code: '\\ker' },
        { latex: '\\Pr', preview: '\\Pr', code: '\\Pr' },
        { latex: '\\bmod', preview: 'a \\bmod b', code: 'a \\bmod b' },
        { latex: '\\pmod{}', preview: '\\pmod{n}', code: '\\pmod{n}' },
        { latex: '\\operatorname{}', preview: '\\operatorname{abc}', code: '\\operatorname{abc}' },
      ],
    },
    {
      name: 'brackets',
      label: 'الأقواس والمحددات',
      items: [
        { latex: '\\left( \\right)', preview: '\\left( \\frac{a}{b} \\right)', code: '\\left( \\right)' },
        { latex: '\\left[ \\right]', preview: '\\left[ x \\right]', code: '\\left[ \\right]' },
        { latex: '\\left\\{ \\right\\}', preview: '\\left\\{ x \\right\\}', code: '\\left\\{ \\right\\}' },
        { latex: '\\langle \\rangle', preview: '\\langle x \\rangle', code: '\\langle \\rangle' },
        { latex: '\\lvert \\rvert', preview: '\\lvert x \\rvert', code: '\\lvert \\rvert' },
        { latex: '\\lVert \\rVert', preview: '\\lVert x \\rVert', code: '\\lVert \\rVert' },
        { latex: '\\lfloor \\rfloor', preview: '\\lfloor x \\rfloor', code: '\\lfloor \\rfloor' },
        { latex: '\\lceil \\rceil', preview: '\\lceil x \\rceil', code: '\\lceil \\rceil' },
        { latex: '\\ulcorner \\urcorner', preview: '\\ulcorner x \\urcorner', code: '\\ulcorner \\urcorner' },
        { latex: '|', preview: '|x|', code: '|x|' },
        { latex: '\\|', preview: '\\|x\\|', code: '\\|x\\|' },
      ],
    },
    {
      name: 'accents',
      label: 'علامات التشكيل',
      items: [
        { latex: '\\hat{}', preview: '\\hat{x}', code: '\\hat{x}' },
        { latex: '\\bar{}', preview: '\\bar{x}', code: '\\bar{x}' },
        { latex: '\\vec{}', preview: '\\vec{x}', code: '\\vec{x}' },
        { latex: '\\dot{}', preview: '\\dot{x}', code: '\\dot{x}' },
        { latex: '\\ddot{}', preview: '\\ddot{x}', code: '\\ddot{x}' },
        { latex: '\\tilde{}', preview: '\\tilde{x}', code: '\\tilde{x}' },
        { latex: '\\breve{}', preview: '\\breve{x}', code: '\\breve{x}' },
        { latex: '\\check{}', preview: '\\check{x}', code: '\\check{x}' },
        { latex: '\\acute{}', preview: '\\acute{x}', code: '\\acute{x}' },
        { latex: '\\grave{}', preview: '\\grave{x}', code: '\\grave{x}' },
        { latex: '\\widehat{}', preview: '\\widehat{abc}', code: '\\widehat{abc}' },
        { latex: '\\widetilde{}', preview: '\\widetilde{abc}', code: '\\widetilde{abc}' },
        { latex: '\\overline{}', preview: '\\overline{abc}', code: '\\overline{abc}' },
        { latex: '\\underline{}', preview: '\\underline{abc}', code: '\\underline{abc}' },
        { latex: '\\overleftarrow{}', preview: '\\overleftarrow{AB}', code: '\\overleftarrow{AB}' },
        { latex: '\\overrightarrow{}', preview: '\\overrightarrow{AB}', code: '\\overrightarrow{AB}' },
        { latex: '\\overleftrightarrow{}', preview: '\\overleftrightarrow{AB}', code: '\\overleftrightarrow{AB}' },
        { latex: '\\underleftarrow{}', preview: '\\underleftarrow{AB}', code: '\\underleftarrow{AB}' },
        { latex: '\\underrightarrow{}', preview: '\\underrightarrow{AB}', code: '\\underrightarrow{AB}' },
        { latex: '\\underleftrightarrow{}', preview: '\\underleftrightarrow{AB}', code: '\\underleftrightarrow{AB}' },
      ],
    },
    {
      name: 'underover',
      label: 'التعليق العلوي والسفلي',
      items: [
        { latex: '\\underset{}{}', preview: '\\underset{x}{\\to}', code: '\\underset{x}{\\to}' },
        { latex: '\\overset{}{}', preview: '\\overset{!}{=}', code: '\\overset{!}{=}' },
        { latex: '\\underbrace{}', preview: '\\underbrace{a+b+c}_{n}', code: '\\underbrace{a+b+c}_{n}' },
        { latex: '\\overbrace{}', preview: '\\overbrace{a+b+c}^{n}', code: '\\overbrace{a+b+c}^{n}' },
        { latex: '\\underbracket{}', preview: '\\underbracket{a+b+c}_{n}', code: '\\underbracket{a+b+c}_{n}' },
        { latex: '\\overbracket{}', preview: '\\overbracket{a+b+c}^{n}', code: '\\overbracket{a+b+c}^{n}' },
      ],
    },
    {
      name: 'matrices',
      label: 'المصفوفات',
      items: [
        { latex: '\\begin{matrix}\n  & \\\\\n  & \n\\end{matrix}', preview: '\\begin{matrix} a & b \\\\ c & d \\end{matrix}', code: '\\begin{matrix}' },
        { latex: '\\begin{pmatrix}\n  & \\\\\n  & \n\\end{pmatrix}', preview: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', code: '\\begin{pmatrix}' },
        { latex: '\\begin{bmatrix}\n  & \\\\\n  & \n\\end{bmatrix}', preview: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', code: '\\begin{bmatrix}' },
        { latex: '\\begin{Bmatrix}\n  & \\\\\n  & \n\\end{Bmatrix}', preview: '\\begin{Bmatrix} a & b \\\\ c & d \\end{Bmatrix}', code: '\\begin{Bmatrix}' },
        { latex: '\\begin{vmatrix}\n  & \\\\\n  & \n\\end{vmatrix}', preview: '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}', code: '\\begin{vmatrix}' },
        { latex: '\\begin{Vmatrix}\n  & \\\\\n  & \n\\end{Vmatrix}', preview: '\\begin{Vmatrix} a & b \\\\ c & d \\end{Vmatrix}', code: '\\begin{Vmatrix}' },
        { latex: '\\begin{cases}\n  \\\\\n\\end{cases}', preview: '\\begin{cases} x & y \\\\ z & w \\end{cases}', code: '\\begin{cases}' },
        { latex: '\\begin{aligned}\n  &= \\\\\n  &= \n\\end{aligned}', preview: '\\begin{aligned} x &= a + b \\\\ y &= c + d \\end{aligned}', code: '\\begin{aligned}' },
        { latex: '\\begin{gathered}\n  \\\\\n\\end{gathered}', preview: '\\begin{gathered} x = a \\\\ y = b \\end{gathered}', code: '\\begin{gathered}' },
        { latex: '\\begin{align}\n  &= \\\\\n  &= \n\\end{align}', preview: '\\begin{align} x &= a & y &= b \\\\ p &= c & q &= d \\end{align}', code: '\\begin{align}' },
        { latex: '\\begin{smallmatrix}', preview: '\\begin{smallmatrix} a & b \\\\ c & d \\end{smallmatrix}', code: '\\begin{smallmatrix}' },
      ],
    },
    {
      name: 'arrows',
      label: 'الأسهم',
      items: [
        { latex: '\\to', preview: '\\to', code: '\\to' },
        { latex: '\\rightarrow', preview: '\\rightarrow', code: '\\rightarrow' },
        { latex: '\\leftarrow', preview: '\\leftarrow', code: '\\leftarrow' },
        { latex: '\\leftrightarrow', preview: '\\leftrightarrow', code: '\\leftrightarrow' },
        { latex: '\\Rightarrow', preview: '\\Rightarrow', code: '\\Rightarrow' },
        { latex: '\\Leftarrow', preview: '\\Leftarrow', code: '\\Leftarrow' },
        { latex: '\\Leftrightarrow', preview: '\\Leftrightarrow', code: '\\Leftrightarrow' },
        { latex: '\\mapsto', preview: '\\mapsto', code: '\\mapsto' },
        { latex: '\\longmapsto', preview: '\\longmapsto', code: '\\longmapsto' },
        { latex: '\\hookrightarrow', preview: '\\hookrightarrow', code: '\\hookrightarrow' },
        { latex: '\\hookleftarrow', preview: '\\hookleftarrow', code: '\\hookleftarrow' },
        { latex: '\\nearrow', preview: '\\nearrow', code: '\\nearrow' },
        { latex: '\\searrow', preview: '\\searrow', code: '\\searrow' },
        { latex: '\\swarrow', preview: '\\swarrow', code: '\\swarrow' },
        { latex: '\\nwarrow', preview: '\\nwarrow', code: '\\nwarrow' },
        { latex: '\\uparrow', preview: '\\uparrow', code: '\\uparrow' },
        { latex: '\\downarrow', preview: '\\downarrow', code: '\\downarrow' },
        { latex: '\\updownarrow', preview: '\\updownarrow', code: '\\updownarrow' },
        { latex: '\\Uparrow', preview: '\\Uparrow', code: '\\Uparrow' },
        { latex: '\\Downarrow', preview: '\\Downarrow', code: '\\Downarrow' },
        { latex: '\\Updownarrow', preview: '\\Updownarrow', code: '\\Updownarrow' },
        { latex: '\\Longrightarrow', preview: '\\Longrightarrow', code: '\\Longrightarrow' },
        { latex: '\\Longleftarrow', preview: '\\Longleftarrow', code: '\\Longleftarrow' },
        { latex: '\\Longleftrightarrow', preview: '\\Longleftrightarrow', code: '\\Longleftrightarrow' },
        { latex: '\\xrightarrow{}', preview: '\\xrightarrow{a}', code: '\\xrightarrow{a}' },
        { latex: '\\xleftarrow{}', preview: '\\xleftarrow{a}', code: '\\xleftarrow{a}' },
        { latex: '\\xmapsto{}', preview: '\\xmapsto{a}', code: '\\xmapsto{a}' },
        { latex: '\\xhookrightarrow{}', preview: '\\xhookrightarrow{a}', code: '\\xhookrightarrow{a}' },
        { latex: '\\xhookleftarrow{}', preview: '\\xhookleftarrow{a}', code: '\\xhookleftarrow{a}' },
      ],
    },
    {
      name: 'symbols',
      label: 'الرموز',
      items: [
        { latex: '\\infty', preview: '\\infty', code: '\\infty' },
        { latex: '\\partial', preview: '\\partial', code: '\\partial' },
        { latex: '\\nabla', preview: '\\nabla', code: '\\nabla' },
        { latex: '\\forall', preview: '\\forall', code: '\\forall' },
        { latex: '\\exists', preview: '\\exists', code: '\\exists' },
        { latex: '\\nexists', preview: '\\nexists', code: '\\nexists' },
        { latex: '\\emptyset', preview: '\\emptyset', code: '\\emptyset' },
        { latex: '\\varnothing', preview: '\\varnothing', code: '\\varnothing' },
        { latex: '\\aleph', preview: '\\aleph', code: '\\aleph' },
        { latex: '\\hbar', preview: '\\hbar', code: '\\hbar' },
        { latex: '\\imath', preview: '\\imath', code: '\\imath' },
        { latex: '\\jmath', preview: '\\jmath', code: '\\jmath' },
        { latex: '\\ell', preview: '\\ell', code: '\\ell' },
        { latex: '\\wp', preview: '\\wp', code: '\\wp' },
        { latex: '\\Re', preview: '\\Re', code: '\\Re' },
        { latex: '\\Im', preview: '\\Im', code: '\\Im' },
        { latex: '\\top', preview: '\\top', code: '\\top' },
        { latex: '\\bot', preview: '\\bot', code: '\\bot' },
        { latex: '\\vdash', preview: '\\vdash', code: '\\vdash' },
        { latex: '\\vDash', preview: '\\vDash', code: '\\vDash' },
        { latex: '\\models', preview: '\\models', code: '\\models' },
        { latex: '\\dashv', preview: '\\dashv', code: '\\dashv' },
        { latex: '\\mid', preview: '\\mid', code: '\\mid' },
        { latex: '\\parallel', preview: '\\parallel', code: '\\parallel' },
        { latex: '\\perp', preview: '\\perp', code: '\\perp' },
        { latex: '\\smile', preview: '\\smile', code: '\\smile' },
        { latex: '\\frown', preview: '\\frown', code: '\\frown' },
      ],
    },
    {
      name: 'sets',
      label: 'مجموعات ومنطق',
      items: [
        { latex: '\\subset', preview: '\\subset', code: '\\subset' },
        { latex: '\\supset', preview: '\\supset', code: '\\supset' },
        { latex: '\\subseteq', preview: '\\subseteq', code: '\\subseteq' },
        { latex: '\\supseteq', preview: '\\supseteq', code: '\\supseteq' },
        { latex: '\\subsetneq', preview: '\\subsetneq', code: '\\subsetneq' },
        { latex: '\\supsetneq', preview: '\\supsetneq', code: '\\supsetneq' },
        { latex: '\\cap', preview: '\\cap', code: '\\cap' },
        { latex: '\\cup', preview: '\\cup', code: '\\cup' },
        { latex: '\\setminus', preview: '\\setminus', code: '\\setminus' },
        { latex: '\\in', preview: '\\in', code: '\\in' },
        { latex: '\\notin', preview: '\\notin', code: '\\notin' },
        { latex: '\\ni', preview: '\\ni', code: '\\ni' },
        { latex: '\\wedge', preview: '\\wedge', code: '\\wedge' },
        { latex: '\\vee', preview: '\\vee', code: '\\vee' },
        { latex: '\\oplus', preview: '\\oplus', code: '\\oplus' },
        { latex: '\\ominus', preview: '\\ominus', code: '\\ominus' },
        { latex: '\\otimes', preview: '\\otimes', code: '\\otimes' },
        { latex: '\\oslash', preview: '\\oslash', code: '\\oslash' },
        { latex: '\\odot', preview: '\\odot', code: '\\odot' },
        { latex: '\\sqcap', preview: '\\sqcap', code: '\\sqcap' },
        { latex: '\\sqcup', preview: '\\sqcup', code: '\\sqcup' },
        { latex: '\\sqsubset', preview: '\\sqsubset', code: '\\sqsubset' },
        { latex: '\\sqsupset', preview: '\\sqsupset', code: '\\sqsupset' },
        { latex: '\\sqsubseteq', preview: '\\sqsubseteq', code: '\\sqsubseteq' },
        { latex: '\\sqsupseteq', preview: '\\sqsupseteq', code: '\\sqsupseteq' },
      ],
    },
    {
      name: 'relations',
      label: 'العلاقات',
      items: [
        { latex: '\\approx', preview: '\\approx', code: '\\approx' },
        { latex: '\\equiv', preview: '\\equiv', code: '\\equiv' },
        { latex: '\\cong', preview: '\\cong', code: '\\cong' },
        { latex: '\\sim', preview: '\\sim', code: '\\sim' },
        { latex: '\\simeq', preview: '\\simeq', code: '\\simeq' },
        { latex: '\\asymp', preview: '\\asymp', code: '\\asymp' },
        { latex: '\\doteq', preview: '\\doteq', code: '\\doteq' },
        { latex: '\\ne', preview: '\\ne', code: '\\ne' },
        { latex: '\\neq', preview: '\\neq', code: '\\neq' },
        { latex: '\\not\\equiv', preview: '\\not\\equiv', code: '\\not\\equiv' },
        { latex: '\\le', preview: '\\le', code: '\\le' },
        { latex: '\\ge', preview: '\\ge', code: '\\ge' },
        { latex: '\\ll', preview: '\\ll', code: '\\ll' },
        { latex: '\\gg', preview: '\\gg', code: '\\gg' },
        { latex: '\\prec', preview: '\\prec', code: '\\prec' },
        { latex: '\\succ', preview: '\\succ', code: '\\succ' },
        { latex: '\\preceq', preview: '\\preceq', code: '\\preceq' },
        { latex: '\\succeq', preview: '\\succeq', code: '\\succeq' },
        { latex: '\\propto', preview: '\\propto', code: '\\propto' },
        { latex: '\\bowtie', preview: '\\bowtie', code: '\\bowtie' },
        { latex: '\\Join', preview: '\\Join', code: '\\Join' },
        { latex: '\\ltimes', preview: '\\ltimes', code: '\\ltimes' },
        { latex: '\\rtimes', preview: '\\rtimes', code: '\\rtimes' },
      ],
    },
    {
      name: 'operators-bin',
      label: 'العوامل الثنائية',
      items: [
        { latex: '\\times', preview: '\\times', code: '\\times' },
        { latex: '\\div', preview: '\\div', code: '\\div' },
        { latex: '\\pm', preview: '\\pm', code: '\\pm' },
        { latex: '\\mp', preview: '\\mp', code: '\\mp' },
        { latex: '\\cdot', preview: '\\cdot', code: '\\cdot' },
        { latex: '\\ast', preview: '\\ast', code: '\\ast' },
        { latex: '\\star', preview: '\\star', code: '\\star' },
        { latex: '\\circ', preview: '\\circ', code: '\\circ' },
        { latex: '\\bullet', preview: '\\bullet', code: '\\bullet' },
        { latex: '\\diamond', preview: '\\diamond', code: '\\diamond' },
        { latex: '\\lhd', preview: '\\lhd', code: '\\lhd' },
        { latex: '\\rhd', preview: '\\rhd', code: '\\rhd' },
        { latex: '\\unlhd', preview: '\\unlhd', code: '\\unlhd' },
        { latex: '\\unrhd', preview: '\\unrhd', code: '\\unrhd' },
        { latex: '\\triangleleft', preview: '\\triangleleft', code: '\\triangleleft' },
        { latex: '\\triangleright', preview: '\\triangleright', code: '\\triangleright' },
        { latex: '\\bigcirc', preview: '\\bigcirc', code: '\\bigcirc' },
        { latex: '\\bigtriangleup', preview: '\\bigtriangleup', code: '\\bigtriangleup' },
        { latex: '\\bigtriangledown', preview: '\\bigtriangledown', code: '\\bigtriangledown' },
      ],
    },
    {
      name: 'geometry',
      label: 'الهندسة',
      items: [
        { latex: '\\angle', preview: '\\angle', code: '\\angle' },
        { latex: '\\measuredangle', preview: '\\measuredangle', code: '\\measuredangle' },
        { latex: '\\sphericalangle', preview: '\\sphericalangle', code: '\\sphericalangle' },
        { latex: '\\triangle', preview: '\\triangle', code: '\\triangle' },
        { latex: '\\triangledown', preview: '\\triangledown', code: '\\triangledown' },
        { latex: '\\square', preview: '\\square', code: '\\square' },
        { latex: '\\blacksquare', preview: '\\blacksquare', code: '\\blacksquare' },
        { latex: '\\lozenge', preview: '\\lozenge', code: '\\lozenge' },
        { latex: '\\blacklozenge', preview: '\\blacklozenge', code: '\\blacklozenge' },
        { latex: '\\bigstar', preview: '\\bigstar', code: '\\bigstar' },
        { latex: '\\clubsuit', preview: '\\clubsuit', code: '\\clubsuit' },
        { latex: '\\diamondsuit', preview: '\\diamondsuit', code: '\\diamondsuit' },
        { latex: '\\heartsuit', preview: '\\heartsuit', code: '\\heartsuit' },
        { latex: '\\spadesuit', preview: '\\spadesuit', code: '\\spadesuit' },
      ],
    },
    {
      name: 'dots',
      label: 'النقاط والحذف',
      items: [
        { latex: '\\cdots', preview: '\\cdots', code: '\\cdots' },
        { latex: '\\vdots', preview: '\\vdots', code: '\\vdots' },
        { latex: '\\ddots', preview: '\\ddots', code: '\\ddots' },
        { latex: '\\ldots', preview: '\\ldots', code: '\\ldots' },
        { latex: '\\cdot', preview: '\\cdot', code: '\\cdot' },
        { latex: '\\dots', preview: 'a, \\dots, z', code: 'a, \\dots, z' },
      ],
    },
    {
      name: 'fonts',
      label: 'أنماط الخطوط',
      items: [
        { latex: '\\mathbb{}', preview: '\\mathbb{R}', code: '\\mathbb{R}' },
        { latex: '\\mathcal{}', preview: '\\mathcal{F}', code: '\\mathcal{F}' },
        { latex: '\\mathbf{}', preview: '\\mathbf{x}', code: '\\mathbf{x}' },
        { latex: '\\mathrm{}', preview: '\\mathrm{sin}', code: '\\mathrm{sin}' },
        { latex: '\\mathsf{}', preview: '\\mathsf{V}', code: '\\mathsf{V}' },
        { latex: '\\mathtt{}', preview: '\\mathtt{x}', code: '\\mathtt{x}' },
        { latex: '\\mathit{}', preview: '\\mathit{x}', code: '\\mathit{x}' },
        { latex: '\\mathfrak{}', preview: '\\mathfrak{g}', code: '\\mathfrak{g}' },
        { latex: '\\mathscr{}', preview: '\\mathscr{L}', code: '\\mathscr{L}' },
        { latex: '\\text{}', preview: '\\text{abc}', code: '\\text{abc}' },
        { latex: '\\textbf{}', preview: '\\textbf{bold}', code: '\\textbf{bold}' },
        { latex: '\\textit{}', preview: '\\textit{italic}', code: '\\textit{italic}' },
      ],
    },
    {
      name: 'spacing',
      label: 'المسافات والتحجيم',
      items: [
        { latex: '\\;', preview: 'a \\; b', code: '\\;' },
        { latex: '\\:', preview: 'a \\: b', code: '\\:' },
        { latex: '\\,', preview: 'a \\, b', code: '\\,' },
        { latex: '\\!', preview: 'a \\! b', code: '\\!' },
        { latex: '\\quad', preview: 'a \\quad b', code: 'a \\quad b' },
        { latex: '\\qquad', preview: 'a \\qquad b', code: 'a \\qquad b' },
        { latex: '\\hspace{}', preview: 'a \\hspace{1em} b', code: '\\hspace{1em}' },
        { latex: '\\vspace{}', preview: '\\vspace{1em}', code: '\\vspace{1em}' },
        { latex: '\\big', preview: '\\big(', code: '\\big' },
        { latex: '\\Big', preview: '\\Big(', code: '\\Big' },
        { latex: '\\bigg', preview: '\\bigg(', code: '\\bigg' },
        { latex: '\\Bigg', preview: '\\Bigg(', code: '\\Bigg' },
      ],
    },
    {
      name: 'trigonometry',
      label: 'دوال مثلثية',
      items: [
        { latex: '\\sin\\theta', preview: '\\sin\\theta', code: '\\sin\\theta' },
        { latex: '\\cos\\theta', preview: '\\cos\\theta', code: '\\cos\\theta' },
        { latex: '\\tan\\theta', preview: '\\tan\\theta', code: '\\tan\\theta' },
        { latex: '\\sin^2\\theta', preview: '\\sin^2\\theta', code: '\\sin^2\\theta' },
        { latex: '\\cos^2\\theta', preview: '\\cos^2\\theta', code: '\\cos^2\\theta' },
        { latex: '\\sin^2\\theta + \\cos^2\\theta = 1', preview: '\\sin^2\\theta + \\cos^2\\theta = 1', code: '\\sin^2\\theta+\\cos^2\\theta=1' },
      ],
    },
    {
      name: 'calculus',
      label: 'التفاضل',
      items: [
        { latex: '\\frac{d}{dx}', preview: '\\frac{d}{dx}', code: '\\frac{d}{dx}' },
        { latex: '\\frac{d}{dx}()', preview: '\\frac{d}{dx}f(x)', code: '\\frac{d}{dx}f(x)' },
        { latex: '\\frac{\\partial}{\\partial}', preview: '\\frac{\\partial}{\\partial x}', code: '\\frac{\\partial}{\\partial x}' },
        { latex: '\\frac{\\partial^2}{\\partial^2}', preview: '\\frac{\\partial^2}{\\partial x^2}', code: '\\frac{\\partial^2}{\\partial x^2}' },
        { latex: "f'", preview: "f'", code: "f'" },
        { latex: "f''", preview: "f''", code: "f''" },
        { latex: "f'''", preview: "f'''", code: "f'''" },
        { latex: '\\nabla^2', preview: '\\nabla^2', code: '\\nabla^2' },
        { latex: '\\Box', preview: '\\Box', code: '\\Box' },
      ],
    },
    {
      name: 'logic',
      label: 'المنطق',
      items: [
        { latex: '\\land', preview: '\\land', code: '\\land' },
        { latex: '\\lor', preview: '\\lor', code: '\\lor' },
        { latex: '\\lnot', preview: '\\lnot', code: '\\lnot' },
        { latex: '\\neg', preview: '\\neg', code: '\\neg' },
        { latex: '\\implies', preview: '\\implies', code: '\\implies' },
        { latex: '\\iff', preview: '\\iff', code: '\\iff' },
        { latex: '\\iff', preview: 'A \\iff B', code: 'A \\iff B' },
        { latex: '\\forall', preview: '\\forall', code: '\\forall' },
        { latex: '\\exists', preview: '\\exists', code: '\\exists' },
        { latex: '\\therefore', preview: '\\therefore', code: '\\therefore' },
        { latex: '\\because', preview: '\\because', code: '\\because' },
      ],
    },
    {
      name: 'bigops',
      label: 'العوامل الكبيرة',
      items: [
        { latex: '\\bigcup', preview: '\\bigcup', code: '\\bigcup' },
        { latex: '\\bigcap', preview: '\\bigcap', code: '\\bigcap' },
        { latex: '\\bigsqcup', preview: '\\bigsqcup', code: '\\bigsqcup' },
        { latex: '\\bigvee', preview: '\\bigvee', code: '\\bigvee' },
        { latex: '\\bigwedge', preview: '\\bigwedge', code: '\\bigwedge' },
        { latex: '\\bigotimes', preview: '\\bigotimes', code: '\\bigotimes' },
        { latex: '\\bigoplus', preview: '\\bigoplus', code: '\\bigoplus' },
        { latex: '\\bigodot', preview: '\\bigodot', code: '\\bigodot' },
        { latex: '\\biguplus', preview: '\\biguplus', code: '\\biguplus' },
        { latex: '\\bigcup_{}^{}', preview: '\\bigcup_{i=1}^{n}', code: '\\bigcup_{i=1}^{n}' },
        { latex: '\\bigcap_{}^{}', preview: '\\bigcap_{i=1}^{n}', code: '\\bigcap_{i=1}^{n}' },
      ],
    },
    {
      name: 'superscript',
      label: 'الأسس والمرافق',
      items: [
        { latex: 'x^2', preview: 'x^2', code: 'x^2' },
        { latex: 'x^{}', preview: 'x^{n+1}', code: 'x^{n+1}' },
        { latex: 'x_i', preview: 'x_i', code: 'x_i' },
        { latex: 'x_{}', preview: 'x_{ij}', code: 'x_{ij}' },
        { latex: 'x_i^2', preview: 'x_i^2', code: 'x_i^2' },
        { latex: 'x_{}^{}', preview: 'x_{ij}^{2}', code: 'x_{ij}^{2}' },
        { latex: 'x\'', preview: "x'", code: "x'" },
        { latex: '\\prime', preview: '\\prime', code: '\\prime' },
        { latex: '\\circ', preview: '90^\\circ', code: '90^\\circ' },
      ],
    },
  ];

  let expanded: Record<string, boolean> = {};
  let previewCache: Record<string, string> = {};

  onMount(() => {
    // Pre-render all previews
    for (const cat of galleryData) {
      for (const item of cat.items) {
        previewCache[item.preview] = renderMath(item.preview, { display: true });
      }
    }
    previewCache = previewCache;
  });

  function toggle(name: string) {
    expanded = { ...expanded, [name]: !expanded[name] };
  }
</script>

<div class="katex-gallery">
  {#each galleryData as cat}
    <div class="kg-category">
      <button class="kg-header" on:click={() => toggle(cat.name)}>
        <svg
          class="kg-chevron"
          class:rotated={expanded[cat.name]}
          viewBox="0 0 24 24"
          stroke="currentColor"
          fill="none"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span>{cat.label}</span>
        <span class="kg-count">{cat.items.length}</span>
      </button>
      {#if expanded[cat.name]}
        <div class="kg-items">
          {#each cat.items as item}
            <button class="kg-item" on:click={() => onInsert(item.latex)}>
              <div class="kg-preview" dir="ltr">
                {#if previewCache[item.preview]}
                  {@html sanitizeHtml(previewCache[item.preview])}
                {:else}
                  <code>{item.code}</code>
                {/if}
              </div>
              <div class="kg-code">
                <code>{item.code}</code>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .katex-gallery {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .kg-category {
    display: flex;
    flex-direction: column;
  }
  .kg-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    background: none;
    border: none;
    color: var(--fg);
    cursor: pointer;
    padding: 6px 8px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.82rem;
    text-align: start;
    transition: background 0.15s;
  }
  .kg-header:hover {
    background: var(--bg-hover);
  }
  .kg-chevron {
    width: 12px;
    height: 12px;
    transition: transform 0.2s;
    flex-shrink: 0;
  }
  .kg-chevron.rotated {
    transform: rotate(90deg);
  }
  .kg-count {
    margin-inline-start: auto;
    font-size: 0.7rem;
    color: var(--fg-muted);
    background: #2a2a2a;
    padding: 0 6px;
    border-radius: 8px;
    line-height: 1.5;
  }
  .kg-items {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 4px;
    padding: 4px 8px 8px 20px;
  }
  .kg-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    background: #2a2a2a;
    border: 1px solid var(--border);
    color: var(--fg);
    cursor: pointer;
    padding: 6px 4px;
    border-radius: 6px;
    transition: background 0.15s, border-color 0.15s, transform 0.1s;
  }
  .kg-item:hover {
    background: #3a3a3a;
    border-color: var(--accent);
    transform: translateY(-1px);
  }
  .kg-item:active {
    transform: translateY(0);
  }
  .kg-preview {
    min-height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    overflow-x: auto;
  }
  .kg-preview :global(.katex-display) {
    margin: 0.15em 0;
    font-size: 0.95rem;
  }
  .kg-preview :global(.katex) {
    font-size: 0.95rem;
  }
  .kg-code {
    width: 100%;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kg-code code {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--fg-muted);
    background: none;
    padding: 0;
    white-space: nowrap;
    direction: ltr;
    unicode-bidi: isolate;
  }
</style>
