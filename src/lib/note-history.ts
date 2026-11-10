/**
 * Undo/redo history, kept separately for every note so that undo in one
 * note can never restore another note's text.
 */

export class TextHistory {
  private entries: string[];
  private index = 0;

  constructor(initial: string, private readonly limit = 200) {
    this.entries = [initial];
  }

  get current(): string {
    return this.entries[this.index];
  }

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index < this.entries.length - 1;
  }

  /** Record a state. Drops any redo branch. Returns false if unchanged. */
  push(value: string): boolean {
    if (this.entries[this.index] === value) return false;
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(value);
    if (this.entries.length > this.limit) this.entries.shift();
    this.index = this.entries.length - 1;
    return true;
  }

  undo(): string | null {
    if (!this.canUndo) return null;
    this.index--;
    return this.entries[this.index];
  }

  redo(): string | null {
    if (!this.canRedo) return null;
    this.index++;
    return this.entries[this.index];
  }
}

export interface HistoryRegistry {
  /** History for `id`; created with `initial` as its first state if new. */
  get(id: string, initial: string): TextHistory;
  has(id: string): boolean;
  drop(id: string): void;
  clear(): void;
}

export function createHistoryRegistry(limit = 200): HistoryRegistry {
  const map = new Map<string, TextHistory>();
  return {
    get(id, initial) {
      let h = map.get(id);
      if (!h) {
        h = new TextHistory(initial, limit);
        map.set(id, h);
      }
      return h;
    },
    has: (id) => map.has(id),
    drop: (id) => void map.delete(id),
    clear: () => map.clear(),
  };
}
