import {
  asSessionId,
  DisposableStore,
  Emitter,
  normalizeTerminalSize,
  ok,
  type PtyExit,
  type Result,
  type SessionId,
} from '@glaceon/domain';
import type { IdGenerator } from '../ports/id-generator';
import type { ForegroundProcess, PtyError, PtyPort } from './pty-port';
import { TerminalSession, type TerminalSessionResources } from './terminal-session';
import type { TerminalView } from './terminal-view';

export interface TerminalSessionServiceDeps {
  readonly pty: PtyPort;
  readonly ids: IdGenerator;
  /** The configured shell for new sessions ('' for the default). */
  readonly shell?: () => string;
}

export interface OpenSessionOptions {
  readonly cwd?: string;
}

export class TerminalSessionService {
  readonly #deps: TerminalSessionServiceDeps;

  constructor(deps: TerminalSessionServiceDeps) {
    this.#deps = deps;
  }

  /**
   * Starts a shell for the given view. The view is fitted before spawning so the shell
   * starts with the real grid size instead of 80x24 followed by a resize.
   */
  async open(
    view: TerminalView,
    options: OpenSessionOptions = {},
  ): Promise<Result<TerminalSession, PtyError>> {
    const { pty, ids } = this.#deps;
    const sessionId = asSessionId(ids.next());
    // Listen before spawning so the first bytes of output are never missed.
    const resources = this.#listen(sessionId, view);
    const shell = this.#deps.shell?.().trim() ?? '';
    const spawned = await pty.spawn({
      sessionId,
      size: normalizeTerminalSize(view.fit()),
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      ...(shell === '' ? {} : { shell }),
    });
    if (!spawned.ok) {
      resources.wiring.dispose();
      return spawned;
    }
    this.#connectInput(sessionId, view, resources.wiring);
    return ok(new TerminalSession(sessionId, spawned.value, resources));
  }

  /**
   * Connects a view to a shell another window detached. The view should already show the
   * snapshot of the old one; buffered output follows it.
   */
  async attach(
    view: TerminalView,
    transfer: { readonly sessionId: SessionId; readonly shell: string },
  ): Promise<Result<TerminalSession, PtyError>> {
    const { pty } = this.#deps;
    const { sessionId } = transfer;
    const resources = this.#listen(sessionId, view);
    const attached = await pty.attach(sessionId);
    if (!attached.ok) {
      resources.wiring.dispose();
      return attached;
    }
    this.#connectInput(sessionId, view, resources.wiring);
    pty.resize(sessionId, normalizeTerminalSize(view.fit()));
    return ok(
      new TerminalSession(sessionId, { pid: attached.value.pid, shell: transfer.shell }, resources),
    );
  }

  #listen(
    sessionId: SessionId,
    view: TerminalView,
  ): TerminalSessionResources & { readonly wiring: DisposableStore } {
    const { pty } = this.#deps;
    const wiring = new DisposableStore();
    const exited = new Emitter<PtyExit>();
    const process = new Emitter<ForegroundProcess>();
    wiring.add(
      pty.onData(sessionId, (chunk) => {
        view.write(chunk, () => pty.acknowledge(sessionId, chunk.byteLength));
      }),
    );
    wiring.add(pty.onProcess(sessionId, (state) => process.emit(state)));
    wiring.add(
      pty.onExit(sessionId, (exit) => {
        wiring.dispose();
        exited.emit(exit);
      }),
    );
    wiring.add({ dispose: () => process.clear() });
    return { pty, wiring, exited, process };
  }

  #connectInput(sessionId: SessionId, view: TerminalView, wiring: DisposableStore): void {
    const { pty } = this.#deps;
    wiring.add(view.onInput((data) => pty.write(sessionId, data)));
    wiring.add(view.onResize((size) => pty.resize(sessionId, normalizeTerminalSize(size))));
  }
}
