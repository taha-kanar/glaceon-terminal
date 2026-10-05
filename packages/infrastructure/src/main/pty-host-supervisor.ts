import { PTY_PORT_IPC_CHANNEL, type PtyHostControlMessage } from '@glaceon/contracts';
import {
  MessageChannelMain,
  utilityProcess,
  type UtilityProcess,
  type WebContents,
} from 'electron';

export interface PtyHostSupervisorOptions {
  /** Absolute path of the bundled pty-host entry. */
  readonly modulePath: string;
  readonly serviceName: string;
  readonly onExit?: (code: number) => void;
}

/** Owns the pty-host utility process and brokers a MessagePort per renderer. */
export class PtyHostSupervisor {
  readonly #options: PtyHostSupervisorOptions;
  #child: UtilityProcess | undefined;

  constructor(options: PtyHostSupervisorOptions) {
    this.#options = options;
  }

  start(): void {
    if (this.#child !== undefined) return;
    const child = utilityProcess.fork(this.#options.modulePath, [], {
      serviceName: this.#options.serviceName,
      stdio: 'inherit',
    });
    child.on('exit', (code) => {
      if (this.#child === child) this.#child = undefined;
      this.#options.onExit?.(code);
    });
    this.#child = child;
  }

  /** Creates a channel: one end goes to the pty host, the other to the renderer. */
  connect(target: WebContents, connectionId: string): void {
    const child = this.#requireChild();
    const { port1, port2 } = new MessageChannelMain();
    child.postMessage({ t: 'connect', connectionId } satisfies PtyHostControlMessage, [port1]);
    target.postMessage(PTY_PORT_IPC_CHANNEL, null, [port2]);
  }

  disconnect(connectionId: string): void {
    this.#child?.postMessage({ t: 'disconnect', connectionId } satisfies PtyHostControlMessage);
  }

  stop(): void {
    this.#child?.kill();
    this.#child = undefined;
  }

  #requireChild(): UtilityProcess {
    if (this.#child === undefined) this.start();
    if (this.#child === undefined) throw new Error('pty host is not running');
    return this.#child;
  }
}
