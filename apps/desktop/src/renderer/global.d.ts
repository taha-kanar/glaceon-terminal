import type { GlaceonBridge } from '@glaceon/contracts';

declare global {
  interface Window {
    readonly glaceon: GlaceonBridge;
    __glaceonE2E?: E2EProbe;
  }
}

/** Read-only hooks for Playwright; only installed when running under e2e. */
export interface E2EProbe {
  terminalText(): string;
  sessionPid(): number | undefined;
}
