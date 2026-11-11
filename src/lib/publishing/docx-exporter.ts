import type { DocumentModel } from './ast';
import type { Exporter, ExportResult } from './exporter';
import { documentToPandocMarkdown } from './pandoc-markdown';
import { invoke } from '@tauri-apps/api/core';
import { getWorkspaceDir } from '$lib/fs';

export class DocxExporter implements Exporter {
  readonly name = 'docx';
  readonly label = 'Word (DOCX)';
  readonly extensions = ['docx'];

  async export(model: DocumentModel): Promise<ExportResult> {
    const workspace = await getWorkspaceDir();
    const pandocMarkdown = documentToPandocMarkdown(model);

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
