import { Emitter, type Disposable, type TerminalSize } from '@glaceon/domain';
import type { TerminalView } from '../terminal/terminal-view';

export class FakeTerminalView implements TerminalView {
  readonly written: Uint8Array[] = [];
  readonly input = new Emitter<string>();
  readonly resize = new Emitter<TerminalSize>();
  fitSize: TerminalSize = { cols: 100, rows: 30 };
  focused = false;
  disposed = false;

  get text(): string {
    const decoder = new TextDecoder();
    return this.written.map((chunk) => decoder.decode(chunk)).join('');
  }

  /** When false, write callbacks are queued in `pendingWrites` instead of called at once. */
  autoAcknowledge = true;
  readonly pendingWrites: (() => void)[] = [];
  cleared = 0;

  write(chunk: Uint8Array, written?: () => void): void {
    this.written.push(chunk);
    if (written === undefined) return;
    if (this.autoAcknowledge) written();
    else this.pendingWrites.push(written);
  }

  restore(snapshot: string): void {
    this.written.push(new TextEncoder().encode(snapshot));
  }

  flush(): Promise<void> {
    return Promise.resolve();
  }

  clear(): void {
    this.cleared++;
  }

  fit(): TerminalSize {
    return this.fitSize;
  }

  focus(): void {
    this.focused = true;
  }

  onInput(listener: (data: string) => void): Disposable {
    return this.input.on(listener);
  }

  onResize(listener: (size: TerminalSize) => void): Disposable {
    return this.resize.on(listener);
  }

  dispose(): void {
    this.disposed = true;
  }
}
