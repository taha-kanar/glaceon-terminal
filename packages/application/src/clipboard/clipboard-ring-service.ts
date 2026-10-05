import { pushClip, type Disposable } from '@glaceon/domain';
import type { Scheduler } from '../ports/scheduler';
import { ObservableStore, type ReadableStore } from '../store/store';

export interface ClipboardPort {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}

export interface ClipboardRingServiceDeps {
  readonly clipboard: ClipboardPort;
  readonly scheduler: Scheduler;
  readonly pollMs?: number;
}

const DEFAULT_POLL_MS = 1000;

/**
 * The last ten texts copied anywhere on the system. macOS has no clipboard change event, so
 * the clipboard is polled; copies made through the app are recorded at once.
 */
export class ClipboardRingService {
  readonly #deps: ClipboardRingServiceDeps;
  readonly #ring = new ObservableStore<readonly string[]>([]);
  #last: string | undefined;
  #timer: Disposable | undefined;
  #polling = false;

  constructor(deps: ClipboardRingServiceDeps) {
    this.#deps = deps;
  }

  get ring(): ReadableStore<readonly string[]> {
    return this.#ring;
  }

  async start(): Promise<void> {
    // Whatever is on the clipboard at start-up counts as the first clip.
    await this.#poll();
    this.#timer = this.#deps.scheduler.setInterval(() => {
      void this.#poll();
    }, this.#deps.pollMs ?? DEFAULT_POLL_MS);
  }

  dispose(): void {
    this.#timer?.dispose();
  }

  async copy(text: string): Promise<void> {
    this.#record(text);
    await this.#deps.clipboard.writeText(text);
  }

  async #poll(): Promise<void> {
    if (this.#polling) return;
    this.#polling = true;
    try {
      const text = await this.#deps.clipboard.readText().catch(() => this.#last ?? '');
      if (text !== this.#last) this.#record(text);
    } finally {
      this.#polling = false;
    }
  }

  #record(text: string): void {
    this.#last = text;
    this.#ring.update((ring) => pushClip(ring, text));
  }
}
