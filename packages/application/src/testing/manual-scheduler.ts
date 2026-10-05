import { toDisposable, type Disposable } from '@glaceon/domain';
import type { Scheduler } from '../ports/scheduler';

interface Timer {
  readonly id: number;
  due: number;
  readonly every: number | undefined;
  readonly callback: () => void;
}

/** A scheduler driven by `advance(ms)` for deterministic tests. */
export class ManualScheduler implements Scheduler {
  readonly #timers = new Map<number, Timer>();
  #now = 0;
  #nextId = 1;

  get pending(): number {
    return this.#timers.size;
  }

  setTimeout(callback: () => void, ms: number): Disposable {
    return this.#add(callback, ms, undefined);
  }

  setInterval(callback: () => void, ms: number): Disposable {
    return this.#add(callback, ms, Math.max(1, ms));
  }

  advance(ms: number): void {
    const end = this.#now + ms;
    for (;;) {
      const next = [...this.#timers.values()]
        .filter((timer) => timer.due <= end)
        .sort((a, b) => a.due - b.due || a.id - b.id)[0];
      if (next === undefined) break;
      this.#now = next.due;
      if (next.every === undefined) this.#timers.delete(next.id);
      else next.due += next.every;
      next.callback();
    }
    this.#now = end;
  }

  #add(callback: () => void, ms: number, every: number | undefined): Disposable {
    const id = this.#nextId++;
    this.#timers.set(id, { id, due: this.#now + Math.max(0, ms), every, callback });
    return toDisposable(() => this.#timers.delete(id));
  }
}
