/**
 * Debounced, per-note save queue.
 *
 * Each pending save remembers *which* note it belongs to at the moment the
 * user typed, so switching notes (or workspaces) can never write one note's
 * text into another, and a switch never silently drops the last edits:
 * callers `flush()` before changing the active note or workspace.
 */

export type SaveWriter = (id: string, content: string) => Promise<void>;

export interface SaveQueueOptions {
  delay?: number;
  /** Called after a successful write when no newer edit is pending for `id`. */
  onSaved?: (id: string) => void;
  onError?: (id: string, error: unknown) => void;
}

export interface SaveQueue {
  schedule(id: string, content: string): void;
  /** Write every pending save now. Resolves when all writes have settled. */
  flush(): Promise<void>;
  hasPending(id?: string): boolean;
  /** Drop pending saves without writing (e.g. the note was deleted). */
  discard(id?: string): void;
}

export function createSaveQueue(writer: SaveWriter, opts: SaveQueueOptions = {}): SaveQueue {
  const delay = opts.delay ?? 500;
  const pending = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight: Promise<void> = Promise.resolve();

  function arm() {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, delay);
  }

  async function writeOne(id: string, content: string) {
    try {
      await writer(id, content);
      if (!pending.has(id)) opts.onSaved?.(id);
    } catch (e) {
      opts.onError?.(id, e);
    }
  }

  function flush(): Promise<void> {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    const batch = [...pending.entries()];
    pending.clear();
    // Chain after earlier writes so two saves of one note never race.
    inflight = inflight.then(async () => {
      for (const [id, content] of batch) await writeOne(id, content);
    });
    return inflight;
  }

  return {
    schedule(id, content) {
      pending.set(id, content);
      arm();
    },
    flush,
    hasPending: (id) => (id === undefined ? pending.size > 0 : pending.has(id)),
    discard(id) {
      if (id === undefined) pending.clear();
      else pending.delete(id);
      if (pending.size === 0 && timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
