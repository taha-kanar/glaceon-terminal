/** Name of the API object the preload exposes on `window`. */
export const BRIDGE_KEY = 'glaceon';

/** Command line switch main passes to renderers when running under e2e tests. */
export const E2E_SWITCH = '--glaceon-e2e';

/** The only surface a renderer has into the privileged world. */
export interface GlaceonBridge {
  readonly e2e: boolean;
  /** Asks main for a pty-host connection; the port arrives as a window message. */
  connectPty(): Promise<void>;
}
