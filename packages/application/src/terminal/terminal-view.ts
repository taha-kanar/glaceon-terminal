import type { Disposable, TerminalSize } from '@glaceon/domain';

/** A rendered terminal surface. Implementations own the actual renderer (xterm.js). */
export interface TerminalView extends Disposable {
  write(chunk: Uint8Array): void;
  /** Fits the view to its container and returns the resulting grid size. */
  fit(): TerminalSize;
  focus(): void;
  onInput(listener: (data: string) => void): Disposable;
  onResize(listener: (size: TerminalSize) => void): Disposable;
}
