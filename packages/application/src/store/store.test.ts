import { describe, expect, it, vi } from 'vitest';
import { computed, ObservableStore } from './store';

describe('ObservableStore', () => {
  it('notifies only on real changes', () => {
    const store = new ObservableStore(1);
    const listener = vi.fn();
    const subscription = store.subscribe(listener);
    store.set(1);
    store.update((v) => v + 1);
    expect(store.get()).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);
    subscription.dispose();
    store.set(5);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('accepts a custom equality', () => {
    const store = new ObservableStore({ a: 1 }, (x, y) => x.a === y.a);
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ a: 1 });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('ComputedStore', () => {
  it('recomputes only when a source changes and keeps identity otherwise', () => {
    const a = new ObservableStore(1);
    const b = new ObservableStore(10);
    const compute = vi.fn(() => ({ sum: a.get() + b.get() }));
    const sum = computed([a, b], compute);
    const first = sum.get();
    expect(sum.get()).toBe(first);
    a.set(2);
    expect(sum.get()).toEqual({ sum: 12 });
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('notifies every subscriber when the value changes, but not for equal results', () => {
    const source = new ObservableStore(1);
    const parity = computed([source], () => source.get() % 2);
    const one = vi.fn();
    const two = vi.fn();
    parity.subscribe(one);
    const sub = parity.subscribe(two);
    source.set(3);
    expect(one).not.toHaveBeenCalled();
    source.set(4);
    expect(one).toHaveBeenCalledTimes(1);
    expect(two).toHaveBeenCalledTimes(1);
    sub.dispose();
    source.set(5);
    expect(two).toHaveBeenCalledTimes(1);
  });
});
