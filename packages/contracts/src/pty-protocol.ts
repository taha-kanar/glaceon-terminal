import type { PtyExit } from '@glaceon/domain';

/** Renderer → pty-host. Session ids travel as plain strings on the wire. */
export type PtyClientMessage =
  | {
      readonly t: 'spawn';
      readonly reqId: number;
      readonly sid: string;
      readonly cols: number;
      readonly rows: number;
      readonly cwd?: string;
    }
  | { readonly t: 'input'; readonly sid: string; readonly data: string }
  | { readonly t: 'resize'; readonly sid: string; readonly cols: number; readonly rows: number }
  | { readonly t: 'kill'; readonly sid: string };

/** pty-host → renderer. */
export type PtyHostMessage =
  | { readonly t: 'spawned'; readonly reqId: number; readonly pid: number }
  | { readonly t: 'spawnFailed'; readonly reqId: number; readonly message: string }
  | { readonly t: 'data'; readonly sid: string; readonly chunk: Uint8Array }
  | ({ readonly t: 'exit'; readonly sid: string } & PtyExit);

/** main → pty-host over the utility process parent port. */
export type PtyHostControlMessage =
  | { readonly t: 'connect'; readonly connectionId: string }
  | { readonly t: 'disconnect'; readonly connectionId: string };
