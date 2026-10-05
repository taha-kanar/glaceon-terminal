import { describe, expect, it, vi } from 'vitest';
import { DisposableStore, toDisposable } from './disposable';

describe('toDisposable', () => {
  it('runs the callback only once', () => {
    const callback = vi.fn();
    const disposable = toDisposable(callback);

    disposable.dispose();
    disposable.dispose();

    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('DisposableStore', () => {
  it('disposes items in reverse registration order', () => {
    const order: string[] = [];
    const store = new DisposableStore();
    store.add(toDisposable(() => order.push('first')));
    store.add(toDisposable(() => order.push('second')));

    store.dispose();

    expect(order).toEqual(['second', 'first']);
    expect(store.isDisposed).toBe(true);
  });

  it('immediately disposes items added after the store was disposed', () => {
    const store = new DisposableStore();
    store.dispose();
    const callback = vi.fn();

    store.add(toDisposable(callback));

    expect(callback).toHaveBeenCalledOnce();
  });
});
