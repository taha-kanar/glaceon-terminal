import type { Disposable } from '@glaceon/domain';

/** Timers behind a port so time-dependent services can be tested with a manual clock. */
export interface Scheduler {
  setTimeout(callback: () => void, ms: number): Disposable;
  setInterval(callback: () => void, ms: number): Disposable;
}
