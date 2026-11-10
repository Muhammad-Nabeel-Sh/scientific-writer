/** App-wide save queue for notes and the bibliography. */
import { createSaveQueue } from './save-queue';
import { writeNote, writeBibliography } from './fs';
import { parseBibTeX } from './bibliography';
import { bibEntries, markTabClean, exportStatus } from './stores';

export const REFERENCES_ID = '__references__';

export const noteSaver = createSaveQueue(
  async (id, content) => {
    if (id === REFERENCES_ID) {
      await writeBibliography(content);
      bibEntries.set(parseBibTeX(content));
    } else {
      await writeNote(id, content);
    }
  },
  {
    delay: 500,
    onSaved: (id) => markTabClean(id),
    onError: (_id, e) => {
      console.error('[save]', e);
      exportStatus.set({ exporting: false, label: '', error: `تعذّر حفظ الملاحظة: ${e}` });
      setTimeout(() => exportStatus.set({ exporting: false, label: '' }), 6000);
    },
  },
);
