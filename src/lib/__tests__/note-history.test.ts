import { describe, it, expect } from 'vitest';
import { TextHistory, createHistoryRegistry } from '$lib/note-history';

describe('TextHistory', () => {
  it('undoes and redoes in order', () => {
    const h = new TextHistory('a');
    h.push('ab');
    h.push('abc');
    expect(h.undo()).toBe('ab');
    expect(h.undo()).toBe('a');
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBe('ab');
    expect(h.redo()).toBe('abc');
    expect(h.redo()).toBeNull();
  });

  it('ignores duplicate consecutive states', () => {
    const h = new TextHistory('a');
    expect(h.push('a')).toBe(false);
    expect(h.canUndo).toBe(false);
  });

  it('drops the redo branch after a new edit', () => {
    const h = new TextHistory('a');
    h.push('ab');
    h.undo();
    h.push('ax');
    expect(h.canRedo).toBe(false);
    expect(h.undo()).toBe('a');
  });

  it('caps the number of states', () => {
    const h = new TextHistory('0', 3);
    h.push('1');
    h.push('2');
    h.push('3');
    expect(h.undo()).toBe('2');
    expect(h.undo()).toBe('1');
    expect(h.undo()).toBeNull();
  });
});

describe('createHistoryRegistry', () => {
  it('keeps notes isolated: undo in B never yields A text', () => {
    const reg = createHistoryRegistry();
    const a = reg.get('A', 'نص أ');
    a.push('نص أ معدل');
    const b = reg.get('B', 'نص ب');
    b.push('نص ب معدل');
    expect(b.undo()).toBe('نص ب');
    expect(b.undo()).toBeNull();
    expect(reg.get('A', 'ignored').current).toBe('نص أ معدل');
  });

  it('clear() forgets everything (workspace switch with reused ids)', () => {
    const reg = createHistoryRegistry();
    reg.get('note-1', 'old workspace').push('old edit');
    reg.clear();
    const h = reg.get('note-1', 'new workspace');
    expect(h.current).toBe('new workspace');
    expect(h.canUndo).toBe(false);
  });
});
