import type { Disposable, TerminalSize } from '@glaceon/domain';

/** A rendered terminal surface. Implementations own the actual renderer (xterm.js). */
export interface TerminalView extends Disposable {
  /** Renders output; `written` is called once the chunk has been processed. */
  write(chunk: Uint8Array, written?: () => void): void;
  /** Pastes text as the user would (bracketed when the program asked for it). */
  paste(text: string): void;
  /** Shows a snapshot of another view (serialized screen and scrollback). */
  restore(snapshot: string): void;
  /** Resolves once every chunk written so far has been processed. */
  flush(): Promise<void>;
  /** Fits the view to its container and returns the resulting grid size. */
  fit(): TerminalSize;
  focus(): void;
  /** Clears the screen and scrollback, keeping the prompt line. */
  clear(): void;
  onInput(listener: (data: string) => void): Disposable;
  onResize(listener: (size: TerminalSize) => void): Disposable;
}
