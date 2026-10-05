export type { IdGenerator } from './ports/id-generator';

export type { PtyError, PtyPort, SpawnedSession, SpawnRequest } from './terminal/pty-port';
export type { TerminalView } from './terminal/terminal-view';
export { TerminalSession } from './terminal/terminal-session';
export {
  TerminalSessionService,
  type OpenSessionOptions,
  type TerminalSessionServiceDeps,
} from './terminal/terminal-session-service';

export { HostConnection } from './pty-host/host-connection';
export type { PtyProcess, PtyProcessFactory, PtySpawnOptions } from './pty-host/pty-process';
export { PtySessionHost, type PtySessionHostDeps } from './pty-host/pty-session-host';
export type { SessionOutput } from './pty-host/session-output';
export {
  buildShellEnvironment,
  type EnvironmentRecord,
  type ShellEnvironmentOptions,
} from './pty-host/shell-environment';
export { defaultShellProfile, FALLBACK_SHELL, type ShellProfile } from './pty-host/shell-profile';
