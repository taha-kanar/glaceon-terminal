import type { Disposable } from '@glaceon/domain';
import type { Scheduler } from '../ports/scheduler';

export interface BatchLimits {
  /** Flush at the latest this long after the first buffered chunk. */
  readonly delayMs: number;
  /** Flush immediately once this many bytes are buffered. */
  readonly maxBytes: number;
}

export const DEFAULT_BATCH_LIMITS: BatchLimits = { delayMs: 5, maxBytes: 256 * 1024 };

/**
 * Coalesces many small pty reads into fewer, larger messages. Order is preserved and
 * `flush()` must be called before anything that has to follow the data (e.g. an exit).
 */
export class OutputBatcher {
  readonly #scheduler: Scheduler;
  readonly #emit: (chunk: Uint8Array) => void;
  readonly #limits: BatchLimits;
  #chunks: Uint8Array[] = [];
  #size = 0;
  #timer: Disposable | undefined;

  constructor(
    scheduler: Scheduler,
    emit: (chunk: Uint8Array) => void,
    limits: BatchLimits = DEFAULT_BATCH_LIMITS,
  ) {
    this.#scheduler = scheduler;
    this.#emit = emit;
    this.#limits = limits;
  }

  push(chunk: Uint8Array): void {
    if (chunk.byteLength === 0) return;
    this.#chunks.push(chunk);
    this.#size += chunk.byteLength;
    if (this.#size >= this.#limits.maxBytes) {
      this.flush();
    } else {
      this.#timer ??= this.#scheduler.setTimeout(() => this.flush(), this.#limits.delayMs);
    }
  }

  flush(): void {
    this.#timer?.dispose();
    this.#timer = undefined;
    if (this.#size === 0) return;
    const chunks = this.#chunks;
    const size = this.#size;
    this.#chunks = [];
    this.#size = 0;
    this.#emit(chunks.length === 1 && chunks[0] !== undefined ? chunks[0] : concat(chunks, size));
  }

  dispose(): void {
    this.#timer?.dispose();
    this.#timer = undefined;
    this.#chunks = [];
    this.#size = 0;
  }
}

function concat(chunks: readonly Uint8Array[], size: number): Uint8Array {
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
