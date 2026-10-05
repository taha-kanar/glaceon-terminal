import type { Scheduler } from '../ports/scheduler';
import { ObservableStore, type ReadableStore } from '../store/store';

export type ToastKind = 'info' | 'error';

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly kind: ToastKind;
}

const VISIBLE_MS = 5000;
const MAX_TOASTS = 3;

/** Short-lived messages in the corner of the window (e.g. "editor not found"). */
export class ToastService {
  readonly #scheduler: Scheduler;
  readonly #toasts = new ObservableStore<readonly Toast[]>([]);
  #nextId = 1;

  constructor(scheduler: Scheduler) {
    this.#scheduler = scheduler;
  }

  get toasts(): ReadableStore<readonly Toast[]> {
    return this.#toasts;
  }

  show(message: string, kind: ToastKind = 'info'): void {
    const toast: Toast = { id: this.#nextId++, message, kind };
    this.#toasts.update((toasts) => [...toasts, toast].slice(-MAX_TOASTS));
    this.#scheduler.setTimeout(() => this.dismiss(toast.id), VISIBLE_MS);
  }

  dismiss(id: number): void {
    this.#toasts.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }
}
