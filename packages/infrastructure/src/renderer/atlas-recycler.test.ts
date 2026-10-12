import { describe, expect, it } from 'vitest';
import { AtlasRecycler } from './atlas-recycler';

function setup() {
  const state = { bytes: 0, now: 0, recycled: 0 };
  const pending: { callback: () => void; delayMs: number }[] = [];
  const recycler = new AtlasRecycler({
    bytes: () => state.bytes,
    recycle: () => {
      state.recycled++;
      state.bytes = 0;
    },
    limit: 100,
    minIntervalMs: 60_000,
    now: () => state.now,
    schedule: (callback, delayMs) => {
      pending.push({ callback, delayMs });
    },
  });
  const runPending = (): void => {
    for (const { callback } of pending.splice(0)) callback();
  };
  return { state, pending, recycler, runPending };
}

describe('AtlasRecycler', () => {
  it('rebuilds once the atlases pass the limit, when idle', () => {
    const { state, pending, recycler, runPending } = setup();
    state.bytes = 99;
    recycler.check();
    expect(pending).toHaveLength(0);

    state.bytes = 100;
    recycler.check();
    recycler.check();
    expect(pending.map(({ delayMs }) => delayMs)).toEqual([0]);
    expect(state.recycled).toBe(0);
    runPending();
    expect(state.recycled).toBe(1);
  });

  it('waits out the minimum interval between rebuilds', () => {
    const { state, pending, recycler, runPending } = setup();
    state.bytes = 200;
    recycler.check();
    runPending();

    state.now = 15_000;
    state.bytes = 200;
    recycler.check();
    expect(pending.map(({ delayMs }) => delayMs)).toEqual([45_000]);
    state.now = 60_000;
    runPending();
    expect(state.recycled).toBe(2);
  });

  it('skips the rebuild when the atlases shrank in the meantime', () => {
    const { state, recycler, runPending } = setup();
    state.bytes = 200;
    recycler.check();
    state.bytes = 10;
    runPending();
    expect(state.recycled).toBe(0);

    // A later growth schedules again.
    state.bytes = 150;
    recycler.check();
    runPending();
    expect(state.recycled).toBe(1);
  });
});
