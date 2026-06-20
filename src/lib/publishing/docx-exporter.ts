import type { DocumentModel } from './ast';
import type { Exporter, ExportResult } from './exporter';
import { invoke } from '@tauri-apps/api/core';
import { getWorkspaceDir } from '$lib/fs';

export class DocxExporter implements Exporter {
  readonly name = 'docx';
  readonly label = 'Word (DOCX)';
  readonly extensions = ['docx'];

  async export(model: DocumentModel, rawMarkdown?: string): Promise<ExportResult> {
    const workspace = await getWorkspaceDir();
    const markdown = rawMarkdown || '';
    
    // We add some basic YAML frontmatter to help pandoc layout
    const direction = model.meta.direction !== 'ltr' ? 'rtl' : 'ltr';
    const mainfont = direction === 'rtl' ? 'Traditional Arabic' : 'Times New Roman';
    
    let pandocMarkdown = `---
title: "${model.meta.title || ''}"
dir: ${direction}
mainfont: "${mainfont}"
---

${markdown}`;

    try {
      const bytes = await invoke<number[]>('export_pandoc', {
        workspace,
        markdown: pandocMarkdown,
        format: 'docx'
      });
      
      const uint8 = Uint8Array.from(bytes);
      // We convert it to a base64 string because ExportResult currently expects
      // the caller to use atob if it's an officedocument and content is string.
      // But we changed ExportResult to accept Uint8Array, so we can just return it!
      
      return {
        content: uint8,
        extension: 'docx',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
    } catch (e) {
      console.error("Pandoc export failed", e);
      throw new Error(`فشل التصدير عبر Pandoc: ${e}`);
    }
  }
}
