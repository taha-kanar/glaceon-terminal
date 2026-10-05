import type { TabImportRequest, TabTransferRequest } from '@glaceon/contracts';
import { describe, expect, it } from 'vitest';
import { TabTransferCoordinator, type TransferWindow } from './tab-transfer-coordinator';
import { decodeTabTransferRequest } from './tab-transfer-schema';

class Window implements TransferWindow {
  readonly received: TabImportRequest[] = [];
  focused = 0;
  constructor(
    readonly id: number,
    readonly bounds = { x: 0, y: 0, width: 100, height: 100 },
  ) {}
  contains(point: { x: number; y: number }): boolean {
    const { x, y, width, height } = this.bounds;
    return point.x >= x && point.x < x + width && point.y >= y && point.y < y + height;
  }
  importTab(request: TabImportRequest): void {
    this.received.push(request);
  }
  focus(): void {
    this.focused++;
  }
}

const payload = {
  locked: false,
  root: { kind: 'leaf', id: 'p' },
  activePane: 'p',
  zoomed: false,
  panes: [{ pane: 'p', transfer: { sessionId: 's', pid: 42, shell: 'zsh', snapshot: 'x' } }],
} as unknown as TabTransferRequest['payload'];

function setup() {
  const windows: Window[] = [
    new Window(1),
    new Window(2, { x: 200, y: 0, width: 100, height: 100 }),
  ];
  const timers: (() => void)[] = [];
  const coordinator = new TabTransferCoordinator({
    windows: () => windows,
    openWindow: () => {
      const window = new Window(windows.length + 1, { x: 900, y: 900, width: 1, height: 1 });
      windows.push(window);
      return window;
    },
    setTimeout: (callback) => {
      timers.push(callback);
      return { dispose: () => timers.splice(timers.indexOf(callback), 1) };
    },
  });
  return { windows, timers, coordinator };
}

describe('TabTransferCoordinator', () => {
  it('delivers to ready windows and resolves with the target result', async () => {
    const { windows, coordinator } = setup();
    coordinator.ready(2);
    const moved = coordinator.transfer(1, { payload, target: { kind: 'window', windowId: 2 } });
    const request = windows[1]?.received[0];
    expect(request?.payload).toBe(payload);
    coordinator.result(1, { transferId: request?.transferId ?? 0, ok: true });
    coordinator.result(2, { transferId: request?.transferId ?? 0, ok: true });
    expect(await moved).toBe(true);
    expect(windows[1]?.focused).toBe(1);
  });

  it('queues imports for new windows until they are ready', async () => {
    const { windows, coordinator } = setup();
    const moved = coordinator.transfer(1, { payload, target: { kind: 'point', x: 5000, y: 5000 } });
    const created = windows[2];
    expect(created?.received).toEqual([]);
    const ready = coordinator.ready(3);
    expect(ready.pending).toBe(1);
    ready.flush();
    coordinator.result(3, { transferId: created?.received[0]?.transferId ?? 0, ok: false });
    expect(await moved).toBe(false);
  });

  it('targets the window under a point, fails on timeouts, closed or unknown targets', async () => {
    const { windows, timers, coordinator } = setup();
    coordinator.ready(2);
    const under = coordinator.transfer(1, { payload, target: { kind: 'point', x: 250, y: 50 } });
    expect(windows[1]?.received).toHaveLength(1);
    timers[0]?.();
    expect(await under).toBe(false);

    const closed = coordinator.transfer(1, { payload, target: { kind: 'window', windowId: 2 } });
    coordinator.closed(2);
    expect(await closed).toBe(false);
    expect(
      await coordinator.transfer(1, { payload, target: { kind: 'window', windowId: 99 } }),
    ).toBe(false);
    expect(
      await coordinator.transfer(1, { payload, target: { kind: 'window', windowId: 1 } }),
    ).toBe(false);
    expect(coordinator.summaries(1)).toEqual([
      { id: 1, title: 'Window 1', current: true },
      { id: 2, title: 'Window 2', current: false },
    ]);
  });
});

describe('decodeTabTransferRequest', () => {
  it('accepts well-formed requests and rejects the rest', () => {
    const split = {
      ...payload,
      root: {
        kind: 'split',
        axis: 'row',
        ratio: 0.5,
        first: { kind: 'leaf', id: 'p' },
        second: { kind: 'leaf', id: 'q' },
      },
    };
    expect(
      decodeTabTransferRequest({ payload: split, target: { kind: 'newWindow' } }),
    ).toBeDefined();
    expect(decodeTabTransferRequest({ payload, target: { kind: 'elsewhere' } })).toBeUndefined();
    expect(
      decodeTabTransferRequest({
        payload: { ...payload, panes: [] },
        target: { kind: 'newWindow' },
      }),
    ).toBeUndefined();
    expect(
      decodeTabTransferRequest({
        payload: { ...payload, root: { kind: 'split' } },
        target: { kind: 'newWindow' },
      }),
    ).toBeUndefined();
  });
});
