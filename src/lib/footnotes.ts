import type MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';

export function footnotePlugin(md: MarkdownIt): void {
  md.use(footnote);

  // Extract footnote plain-text content for hover preview titles.
  // Runs after footnote_tail has populated the footnotes in the token stream.
  md.core.ruler.after('footnote_tail', 'store_footnote_content', (state) => {
    const footnotes = state.env.footnotes;
    if (!footnotes?.list) return;

    for (let i = 0; i < state.tokens.length; i++) {
      if (state.tokens[i].type !== 'footnote_open') continue;
      const id = state.tokens[i].meta.id;
      const texts: string[] = [];
      let j = i + 1;
      while (
        j < state.tokens.length &&
        state.tokens[j].type !== 'footnote_anchor' &&
        state.tokens[j].type !== 'footnote_close'
      ) {
        if (state.tokens[j].type === 'inline' && state.tokens[j].content) {
          texts.push(state.tokens[j].content);
        }
        j++;
      }
      const content = texts.join(' ').trim();
      if (content && !footnotes.list[id].content) {
        footnotes.list[id].content = content;
      }
    }
  });

  md.renderer.rules.footnote_ref = (tokens, idx, options, env, slf) => {
    const meta = tokens[idx].meta;
    const id = meta.id;
    const subId = meta.subId || 0;
    const num = Number(id + 1);
    const refAnchor = subId > 0 ? `${num}:${subId}` : String(num);

    let title = '';
    if (env.footnotes?.list?.[id]?.content) {
      const raw = env.footnotes.list[id].content;
      title = ` title="${md.utils.escapeHtml(raw)}"`;
    }

    return `<sup class="footnote-ref" id="fnref${refAnchor}"><a href="#fn${num}"${title}>${num}</a></sup>`;
  };

  md.renderer.rules.footnote_open = (tokens, idx, options, env, slf) => {
    const num = Number(tokens[idx].meta.id + 1);
    return `<li id="fn${num}" class="footnote-item">`;
  };

  md.renderer.rules.footnote_anchor = (tokens, idx, options, env, slf) => {
    const num = Number(tokens[idx].meta.id + 1);
    const subId = tokens[idx].meta.subId || 0;
    const anchor = subId > 0 ? `${num}:${subId}` : String(num);
    return ` <a href="#fnref${anchor}" class="footnote-backref" title="Jump to reference">↩</a>`;
  };

  md.renderer.rules.footnote_block_open = (tokens, idx, options, env, slf) => {
    return '<hr class="footnotes-sep">\n<section class="footnotes">\n<ol class="footnotes-list">\n';
  };

  md.renderer.rules.footnote_block_close = (tokens, idx, options, env, slf) => {
    return '</ol>\n</section>\n';
  };
}
