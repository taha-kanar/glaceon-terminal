import type {
  TabImportRequest,
  TabImportResult,
  TabTransferRequest,
  WindowSummaryWire,
} from '@glaceon/contracts';

/** What the coordinator needs from a window. */
export interface TransferWindow {
  readonly id: number;
  contains(point: { readonly x: number; readonly y: number }): boolean;
  importTab(request: TabImportRequest): void;
  focus(): void;
}

export interface TabTransferCoordinatorDeps {
  readonly windows: () => readonly TransferWindow[];
  /** Opens a window (near `at`, when given) that will import a tab instead of opening one. */
  readonly openWindow: (at?: { readonly x: number; readonly y: number }) => TransferWindow;
  readonly setTimeout: (callback: () => void, ms: number) => { dispose(): void };
  readonly timeoutMs?: number;
}

interface Pending {
  readonly target: number;
  readonly resolve: (ok: boolean) => void;
  readonly timer: { dispose(): void };
}

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Routes tabs between windows. A window receives imports only once it reported ready; a
 * transfer that is not confirmed in time counts as failed, so the source rolls back.
 */
export class TabTransferCoordinator {
  readonly #deps: TabTransferCoordinatorDeps;
  readonly #pending = new Map<number, Pending>();
  readonly #ready = new Set<number>();
  readonly #queued = new Map<number, TabImportRequest[]>();
  #nextId = 1;

  constructor(deps: TabTransferCoordinatorDeps) {
    this.#deps = deps;
  }

  transfer(source: number, request: TabTransferRequest): Promise<boolean> {
    const target = this.#resolveTarget(source, request.target);
    if (target === undefined) return Promise.resolve(false);
    const transferId = this.#nextId++;
    return new Promise((resolve) => {
      const timer = this.#deps.setTimeout(() => {
        this.#settle(transferId, false);
      }, this.#deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      this.#pending.set(transferId, { target: target.id, resolve, timer });
      this.#deliver(target, { transferId, payload: request.payload });
      target.focus();
    });
  }

  /** A window finished wiring up; returns how many imports it is about to receive. */
  ready(windowId: number): { readonly pending: number; readonly flush: () => void } {
    this.#ready.add(windowId);
    const queued = this.#queued.get(windowId) ?? [];
    this.#queued.delete(windowId);
    const window = this.#deps.windows().find((w) => w.id === windowId);
    return {
      pending: queued.length,
      flush: () => {
        for (const request of queued) window?.importTab(request);
      },
    };
  }

  /** The target reports whether it adopted the tab. Results from other windows are ignored. */
  result(windowId: number, result: TabImportResult): void {
    if (this.#pending.get(result.transferId)?.target !== windowId) return;
    this.#settle(result.transferId, result.ok);
  }

  closed(windowId: number): void {
    this.#ready.delete(windowId);
    this.#queued.delete(windowId);
    for (const [id, pending] of this.#pending) {
      if (pending.target === windowId) this.#settle(id, false);
    }
  }

  /** Every window, as seen by `viewer`. */
  summaries(viewer: number): WindowSummaryWire[] {
    return this.#deps.windows().map((window, index) => ({
      id: window.id,
      title: `Window ${String(index + 1)}`,
      current: window.id === viewer,
    }));
  }

  #resolveTarget(source: number, target: TabTransferRequest['target']): TransferWindow | undefined {
    switch (target.kind) {
      case 'window':
        return target.windowId === source
          ? undefined
          : this.#deps.windows().find((window) => window.id === target.windowId);
      case 'newWindow':
        return this.#deps.openWindow();
      case 'point': {
        const under = this.#deps
          .windows()
          .find((window) => window.id !== source && window.contains(target));
        return under ?? this.#deps.openWindow({ x: target.x, y: target.y });
      }
    }
  }

  #deliver(target: TransferWindow, request: TabImportRequest): void {
    if (this.#ready.has(target.id)) {
      target.importTab(request);
      return;
    }
    const queue = this.#queued.get(target.id) ?? [];
    queue.push(request);
    this.#queued.set(target.id, queue);
  }

  #settle(transferId: number, ok: boolean): void {
    const pending = this.#pending.get(transferId);
    if (pending === undefined) return;
    this.#pending.delete(transferId);
    pending.timer.dispose();
    pending.resolve(ok);
  }
}
