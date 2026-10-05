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

  write(chunk: Uint8Array): void {
    this.written.push(chunk);
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
