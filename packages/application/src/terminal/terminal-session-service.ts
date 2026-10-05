import {
  asSessionId,
  DisposableStore,
  Emitter,
  normalizeTerminalSize,
  ok,
  type PtyExit,
  type Result,
} from '@glaceon/domain';
import type { IdGenerator } from '../ports/id-generator';
import type { ForegroundProcess, PtyError, PtyPort } from './pty-port';
import { TerminalSession } from './terminal-session';
import type { TerminalView } from './terminal-view';

export interface TerminalSessionServiceDeps {
  readonly pty: PtyPort;
  readonly ids: IdGenerator;
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
    const wiring = new DisposableStore();
    const exited = new Emitter<PtyExit>();
    const process = new Emitter<ForegroundProcess>();

    // Listen before spawning so the first bytes of output are never missed.
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

    const spawned = await pty.spawn({
      sessionId,
      size: normalizeTerminalSize(view.fit()),
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    });
    if (!spawned.ok) {
      wiring.dispose();
      return spawned;
    }

    wiring.add(view.onInput((data) => pty.write(sessionId, data)));
    wiring.add(view.onResize((size) => pty.resize(sessionId, normalizeTerminalSize(size))));
    wiring.add({ dispose: () => process.clear() });

    return ok(new TerminalSession(sessionId, spawned.value, { pty, wiring, exited, process }));
  }
}
