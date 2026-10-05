export type { Brand } from './shared/brand';
export { asSessionId, type SessionId } from './shared/ids';
export { err, ok, type Err, type Ok, type Result } from './shared/result';
export { DisposableStore, toDisposable, type Disposable } from './shared/disposable';
export { Emitter, KeyedEmitter, type Listener } from './shared/emitter';
export {
  MAX_TERMINAL_DIMENSION,
  MIN_TERMINAL_DIMENSION,
  normalizeTerminalSize,
  type TerminalSize,
} from './terminal/terminal-size';
export type { PtyExit } from './terminal/pty-exit';
