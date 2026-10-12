import { homedir } from 'node:os';
import { buildShellEnvironment, defaultShellProfile, PtySessionHost } from '@glaceon/application';
import { decodePtyHostControlMessage } from '@glaceon/contracts';
import type { Disposable } from '@glaceon/domain';
import {
  MacProcessInspector,
  MacProcessTable,
  NodeProcessSignaller,
  NodePtyProcessFactory,
  servePtyConnection,
  TimerScheduler,
} from '@glaceon/infrastructure/pty-host';

export interface PtyHostCompositionRoot {
  start(): void;
}

/** Wires the pty-host utility process: one PtySessionHost shared by every window. */
export function createPtyHostCompositionRoot(): PtyHostCompositionRoot {
  const shellEnv = buildShellEnvironment(process.env, {
    termProgram: 'Glaceon',
    termProgramVersion: process.env['GLACEON_VERSION'] ?? '0.0.0',
    fallbackLang: 'en_US.UTF-8',
  });
  const host = new PtySessionHost({
    processes: new NodePtyProcessFactory(),
    shell: defaultShellProfile({ env: process.env, shellEnv, homeDirectory: homedir() }),
    scheduler: new TimerScheduler(),
    inspector: new MacProcessInspector(),
    table: new MacProcessTable(),
    signaller: new NodeProcessSignaller(),
    now: () => performance.now(),
  });
  const connections = new Map<string, Disposable>();

  return {
    start() {
      process.parentPort.on('message', (event) => {
        const message = decodePtyHostControlMessage(event.data);
        if (message === undefined) return;
        if (message.t === 'disconnect') {
          connections.get(message.connectionId)?.dispose();
          connections.delete(message.connectionId);
          return;
        }
        const port = event.ports[0];
        if (port === undefined) return;
        const { connectionId } = message;
        connections.get(connectionId)?.dispose();
        const served = servePtyConnection(port, host, () => {
          // The renderer went away (a crash, say) without main asking to disconnect.
          if (connections.get(connectionId) === served) connections.delete(connectionId);
        });
        connections.set(connectionId, served);
      });
      process.on('exit', () => {
        host.dispose();
      });
    },
  };
}
