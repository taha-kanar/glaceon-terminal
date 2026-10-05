import type { Settings } from '@glaceon/domain';

/** Name of the API object the preload exposes on `window`. */
export const BRIDGE_KEY = 'glaceon';

/** Command line switch main passes to renderers when running under e2e tests. */
export const E2E_SWITCH = '--glaceon-e2e';

/** Settings as main sends them: always usable values plus problems with the file, if any. */
export interface SettingsSnapshot {
  readonly settings: Settings;
  readonly problems: readonly string[];
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

export type Unsubscribe = () => void;

/** The only surface a renderer has into the privileged world. */
export interface GlaceonBridge {
  readonly e2e: boolean;
  /** Asks main for a pty-host connection; the port arrives as a window message. */
  connectPty(): Promise<void>;
  getSettings(): Promise<SettingsSnapshot>;
  /** Validated and written by main; the new snapshot follows via `onSettingsChanged`. */
  updateSetting(request: SettingsUpdateRequest): Promise<SettingsUpdateResult>;
  onSettingsChanged(listener: (snapshot: SettingsSnapshot) => void): Unsubscribe;
  onRunCommand(listener: (request: RunCommandRequest) => void): Unsubscribe;
  onCloseRequested(listener: () => void): Unsubscribe;
  newWindow(): void;
  /** Closes this window without asking again (the renderer already confirmed). */
  closeWindow(): void;
  openSettingsFile(): void;
}
