import type { Disposable, PtyExit, SessionId, TerminalSize } from '@glaceon/domain';
import type { Scheduler } from '../ports/scheduler';
import { FlowController, type FlowWatermarks } from './flow-controller';
import { OutputBatcher, type BatchLimits } from './output-batcher';
import type { ProcessInspector } from './process-inspector';
import type { PtyProcess } from './pty-process';
import type { DetachBuffer } from './detach-buffer';
import type { SessionOutput } from './session-output';

export interface FlowSettings {
  readonly batch?: BatchLimits;
  readonly watermarks?: FlowWatermarks;
}

export interface HostSessionDeps {
  readonly scheduler: Scheduler;
  readonly output: SessionOutput;
  readonly inspector: ProcessInspector;
  /** Name to compare against when the shell's own process name cannot be read. */
  readonly shellName: string;
  readonly flow?: FlowSettings;
  /** Called once the process has exited and its last output was delivered. */
  readonly onExit: (exit: PtyExit) => void;
}

/** A pty owned by a connection: batched output with back-pressure and foreground tracking. */
export class HostSession {
  readonly #id: SessionId;
  readonly #process: PtyProcess;
  readonly #batcher: OutputBatcher;
  readonly #flow: FlowController;
  readonly #subscriptions: Disposable[];
  readonly #deps: HostSessionDeps;
  #output: SessionOutput;
  #onExit: (exit: PtyExit) => void;
  #foreground: string;
  #exited = false;

  constructor(id: SessionId, process: PtyProcess, deps: HostSessionDeps) {
    this.#id = id;
    this.#process = process;
    this.#deps = deps;
    this.#output = deps.output;
    this.#onExit = deps.onExit;
    this.#foreground = process.foregroundProcess;
    this.#flow = new FlowController(process, deps.flow?.watermarks);
    this.#batcher = new OutputBatcher(
      deps.scheduler,
      (chunk) => {
        this.#flow.sent(chunk.byteLength);
        this.#output.data(id, chunk);
      },
      deps.flow?.batch,
    );
    this.#subscriptions = [
      process.onData((chunk) => this.#batcher.push(chunk)),
      process.onExit((exit) => this.#exit(exit)),
    ];
  }

  get pid(): number {
    return this.#process.pid;
  }

  write(data: string): void {
    this.#process.write(data);
  }

  resize(size: TerminalSize): void {
    this.#process.resize(size);
  }

  kill(): void {
    this.#process.kill();
  }

  /** Delivers pending output to the current owner, then buffers everything into `buffer`. */
  detach(buffer: DetachBuffer, onExit: (exit: PtyExit) => void): void {
    this.#batcher.flush();
    this.#output = buffer;
    this.#onExit = onExit;
  }

  /**
   * Hands the session to a new owner: what was buffered while detached is replayed first.
   * The old owner's unacknowledged bytes are forgotten so output is not stuck paused.
   */
  attach(
    buffer: DetachBuffer,
    owner: { output: SessionOutput; onExit: (exit: PtyExit) => void },
  ): void {
    this.#flow.reset();
    this.#output = owner.output;
    this.#onExit = owner.onExit;
    buffer.replay(this.#id, {
      output: owner.output,
      sent: (bytes) => this.#flow.sent(bytes),
      exited: (exit) => owner.onExit(exit),
    });
  }

  acknowledge(bytes: number): void {
    this.#flow.acknowledged(bytes);
  }

  /**
   * Reports the foreground process when it changed since the last check. It is busy unless it
   * is the shell itself (compared by the shell process's real name: `/bin/sh` runs `bash`).
   * The name is looked up on every change, never cached: a shell that is still exec'ing
   * (`sh` → `bash`) would otherwise count as busy for the rest of its life.
   */
  checkForeground(): void {
    const name = this.#process.foregroundProcess;
    if (name === this.#foreground || name === '') return;
    this.#foreground = name;
    void this.#resolveShellName().then((shell) => {
      if (this.#exited || this.#foreground !== name) return;
      // The two reads are not atomic: a shell exec-ing during the lookup (`sh` → `bash`) gives
      // a stale name here. Look again instead of reporting a false "busy".
      if (this.#process.foregroundProcess !== name) {
        this.#foreground = '';
        this.checkForeground();
        return;
      }
      this.#output.process(this.#id, { name, busy: name !== shell });
    });
  }

  #resolveShellName(): Promise<string> {
    return this.#deps.inspector
      .nameOf(this.#process.pid)
      .catch(() => undefined)
      .then((name) => name ?? this.#deps.shellName);
  }

  #exit(exit: PtyExit): void {
    this.#exited = true;
    for (const subscription of this.#subscriptions) subscription.dispose();
    this.#batcher.flush();
    this.#batcher.dispose();
    this.#output.exit(this.#id, exit);
    this.#onExit(exit);
  }
}
