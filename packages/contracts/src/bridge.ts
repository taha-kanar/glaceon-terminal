import type { PaneId, PaneNode, SessionId, Settings, Snippet, TabColor } from '@glaceon/domain';

/** Name of the API object the preload exposes on `window`. */
export const BRIDGE_KEY = 'glaceon';

/** Command line switch main passes to renderers when running under e2e tests. */
export const E2E_SWITCH = '--glaceon-e2e';

/** Command line switch of the quake (drop-down) window's renderer. */
export const QUAKE_SWITCH = '--glaceon-quake';

/** Settings as main sends them: always usable values plus problems with the file, if any. */
export interface SettingsSnapshot {
  readonly settings: Settings;
  readonly problems: readonly string[];
  /** Whether the quake shortcut could be registered (main fills this in). */
  readonly quake?: QuakeStatus;
}

export interface SnippetsSnapshot {
  readonly snippets: readonly Snippet[];
  readonly problem?: string;
}

export interface QuakeStatus {
  readonly registered: boolean;
  readonly error?: string;
}

export interface RunCommandRequest {
  readonly command: string;
  readonly args?: string | number;
}

export interface SettingsUpdateRequest {
  readonly key: string;
  readonly value: unknown;
}

export type SettingsUpdateResult =
  { readonly ok: true } | { readonly ok: false; readonly error: string };

export type LinkOpenRequest =
  | { readonly kind: 'url'; readonly url: string }
  | {
      readonly kind: 'file';
      readonly path: string;
      readonly cwd?: string;
      readonly line?: number;
      readonly column?: number;
    };

export type OperationResult = SettingsUpdateResult;

/** A running shell moving between windows (see the pty `detach`/`attach` messages). */
export interface PaneTransferWire {
  readonly sessionId: SessionId;
  readonly pid: number;
  readonly shell: string;
  readonly process?: string;
  readonly busy?: boolean;
  readonly snapshot?: string;
}

export interface TabPayloadWire {
  readonly title?: string;
  readonly color?: TabColor;
  readonly locked: boolean;
  readonly root: PaneNode;
  readonly activePane: PaneId;
  readonly zoomed: boolean;
  readonly panes: readonly { readonly pane: PaneId; readonly transfer?: PaneTransferWire }[];
}

export type TransferTargetWire =
  | { readonly kind: 'window'; readonly windowId: number }
  | { readonly kind: 'newWindow' }
  | { readonly kind: 'point'; readonly x: number; readonly y: number };

export interface TabTransferRequest {
  readonly payload: TabPayloadWire;
  readonly target: TransferTargetWire;
}

export interface TabImportRequest {
  readonly transferId: number;
  readonly payload: TabPayloadWire;
}

export interface TabImportResult {
  readonly transferId: number;
  readonly ok: boolean;
}

export interface WindowSummaryWire {
  readonly id: number;
  readonly title: string;
  readonly current: boolean;
}

export type Unsubscribe = () => void;

/** The only surface a renderer has into the privileged world. */
export interface GlaceonBridge {
  readonly e2e: boolean;
  readonly windowKind: 'normal' | 'quake';
  /** Asks main for a pty-host connection; the port arrives as a window message. */
  connectPty(): Promise<void>;
  getSettings(): Promise<SettingsSnapshot>;
  openLink(request: LinkOpenRequest): Promise<OperationResult>;
  /** Validated and written by main; the new snapshot follows via `onSettingsChanged`. */
  updateSetting(request: SettingsUpdateRequest): Promise<SettingsUpdateResult>;
  onSettingsChanged(listener: (snapshot: SettingsSnapshot) => void): Unsubscribe;
  onRunCommand(listener: (request: RunCommandRequest) => void): Unsubscribe;
  onCloseRequested(listener: () => void): Unsubscribe;
  /** Resolves true once the target window adopted the tab's shells. */
  transferTab(request: TabTransferRequest): Promise<boolean>;
  /** Handles tabs moved here; the listener resolves true once it adopted the shells. */
  onImportTab(listener: (payload: TabPayloadWire) => Promise<boolean>): Unsubscribe;
  /** Tells main the window is wired up; returns how many imported tabs are on their way. */
  windowReady(): Promise<number>;
  onWindowsChanged(listener: (windows: readonly WindowSummaryWire[]) => void): Unsubscribe;
  getSnippets(): Promise<SnippetsSnapshot>;
  onSnippetsChanged(listener: (snapshot: SnippetsSnapshot) => void): Unsubscribe;
  openSnippetsFile(): void;
  /** Newest first, at most ten. */
  getClipboardRing(): Promise<readonly string[]>;
  onClipboardRingChanged(listener: (ring: readonly string[]) => void): Unsubscribe;
  /** Copies to the system clipboard (and the ring). */
  writeClipboard(text: string): void;
  newWindow(): void;
  /** Closes this window without asking again (the renderer already confirmed). */
  closeWindow(): void;
  openSettingsFile(): void;
}
