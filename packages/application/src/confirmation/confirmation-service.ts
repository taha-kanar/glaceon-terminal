import { ObservableStore, type ReadableStore } from '../store/store';

export interface ConfirmationRequest {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
}

interface Pending {
  readonly request: ConfirmationRequest;
  readonly resolve: (confirmed: boolean) => void;
}

/** In-window confirmation dialogs. Requests are queued and answered one at a time. */
export class ConfirmationService {
  readonly #queue: Pending[] = [];
  readonly #current = new ObservableStore<ConfirmationRequest | undefined>(undefined);

  get current(): ReadableStore<ConfirmationRequest | undefined> {
    return this.#current;
  }

  confirm(request: ConfirmationRequest): Promise<boolean> {
    return new Promise((resolve) => {
      this.#queue.push({ request, resolve });
      if (this.#queue.length === 1) this.#current.set(request);
    });
  }

  answer(confirmed: boolean): void {
    const pending = this.#queue.shift();
    if (pending === undefined) return;
    this.#current.set(this.#queue[0]?.request);
    pending.resolve(confirmed);
  }
}
