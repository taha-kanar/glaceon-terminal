import { describe, expect, it, vi } from 'vitest';
import { Emitter, KeyedEmitter } from './emitter';

describe('Emitter', () => {
  it('delivers values to current listeners and stops after dispose', () => {
    const emitter = new Emitter<number>();
    const listener = vi.fn();
    const subscription = emitter.on(listener);

    emitter.emit(1);
    subscription.dispose();
    emitter.emit(2);

    expect(listener).toHaveBeenCalledExactlyOnceWith(1);
    expect(emitter.size).toBe(0);
  });

  it('does not call listeners added during an emit', () => {
    const emitter = new Emitter<number>();
    const late = vi.fn();
    emitter.on(() => emitter.on(late));

    emitter.emit(1);

    expect(late).not.toHaveBeenCalled();
  });
});

describe('KeyedEmitter', () => {
  it('routes values by key and forgets keys without listeners', () => {
    const emitter = new KeyedEmitter<string, number>();
    const a = vi.fn();
    const b = vi.fn();
    const subscription = emitter.on('a', a);
    emitter.on('b', b);

    emitter.emit('a', 1);
    subscription.dispose();
    emitter.emit('a', 2);

    expect(a).toHaveBeenCalledExactlyOnceWith(1);
    expect(b).not.toHaveBeenCalled();
    expect(emitter.size('a')).toBe(0);
    expect(emitter.size('b')).toBe(1);
  });
});
