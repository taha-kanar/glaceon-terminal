import type { GlaceonBridge } from '@glaceon/contracts';

declare global {
  interface Window {
    readonly glaceon: GlaceonBridge;
    __glaceonE2E?: E2EProbe;
  }
}

export interface ProbeTab {
  readonly id: string;
  readonly active: boolean;
  readonly panes: readonly string[];
  readonly activePane: string;
  readonly zoomed: boolean;
}

export interface ProbeSessionInfo {
  readonly pid?: number;
  readonly shell?: string;
  readonly process?: string;
  readonly exit?: { readonly exitCode: number; readonly signal?: number };
  readonly error?: string;
}

/** Read-only hooks for Playwright; only installed when running under e2e. */
export interface E2EProbe {
  /** Text of a pane's terminal (the active pane when omitted). */
  terminalText(pane?: string): string;
  sessionPid(pane?: string): number | undefined;
  activePane(): string | undefined;
  workspace(): ProbeTab[];
  sessionInfo(pane: string): ProbeSessionInfo | undefined;
  problems(): string[];
  fontSize(): number;
  rendererKind(pane: string): 'webgl' | 'dom' | undefined;
}
