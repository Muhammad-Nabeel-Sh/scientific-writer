import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSaveQueue } from '$lib/save-queue';

describe('createSaveQueue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('debounces and writes the latest content per note', async () => {
    const writes: [string, string][] = [];
    const q = createSaveQueue(async (id, c) => void writes.push([id, c]), { delay: 500 });
    q.schedule('A', '1');
    q.schedule('A', '12');
    await vi.advanceTimersByTimeAsync(499);
    expect(writes).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(writes).toEqual([['A', '12']]);
  });

  it('keeps each note bound to its own content across a switch', async () => {
    const writes: [string, string][] = [];
    const q = createSaveQueue(async (id, c) => void writes.push([id, c]));
    q.schedule('A', 'text of A');
    q.schedule('B', 'text of B'); // user switched to B before A was saved
    await q.flush();
    expect(writes).toEqual([
      ['A', 'text of A'],
      ['B', 'text of B'],
    ]);
  });

  it('saves empty content (an emptied note must reach disk)', async () => {
    const writer = vi.fn(async () => {});
    const q = createSaveQueue(writer);
    q.schedule('A', '');
    await q.flush();
    expect(writer).toHaveBeenCalledWith('A', '');
  });

  it('reports errors and does not mark the note saved', async () => {
    const onSaved = vi.fn();
    const onError = vi.fn();
    const q = createSaveQueue(async () => { throw new Error('disk full'); }, { onSaved, onError });
    q.schedule('A', 'x');
    await q.flush();
    expect(onError).toHaveBeenCalledWith('A', expect.any(Error));
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('does not mark clean when a newer edit arrived during the write', async () => {
    const onSaved = vi.fn();
    let release!: () => void;
    const q = createSaveQueue(
      () => new Promise<void>((r) => (release = r)),
      { onSaved },
    );
    q.schedule('A', 'v1');
    const f = q.flush();
    await Promise.resolve();
    q.schedule('A', 'v2'); // typed while v1 was being written
    release();
    await f;
    expect(onSaved).not.toHaveBeenCalled();
    expect(q.hasPending('A')).toBe(true);
  });

  it('discard() drops pending writes', async () => {
    const writer = vi.fn(async () => {});
    const q = createSaveQueue(writer);
    q.schedule('A', 'x');
    q.discard('A');
    await vi.advanceTimersByTimeAsync(1000);
    await q.flush();
    expect(writer).not.toHaveBeenCalled();
  });
});
