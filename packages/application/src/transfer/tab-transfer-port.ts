import type { PaneId, PaneNode, TabColor } from '@glaceon/domain';
import type { PaneTransfer } from '../terminal/session-manager';

/** A tab on its way to another window: its layout and the running shells of its panes. */
export interface TabPayload {
  readonly title?: string;
  readonly color?: TabColor;
  readonly locked: boolean;
  readonly root: PaneNode;
  readonly activePane: PaneId;
  readonly zoomed: boolean;
  /** Panes without `transfer` had no live shell; the new window starts one. */
  readonly panes: readonly { readonly pane: PaneId; readonly transfer?: PaneTransfer }[];
}

export type TransferTarget =
  | { readonly kind: 'window'; readonly windowId: number }
  | { readonly kind: 'newWindow' }
  /** The window under a screen point (other than the source), or a new window there. */
  | { readonly kind: 'point'; readonly x: number; readonly y: number };

export interface WindowSummary {
  readonly id: number;
  readonly title: string;
  /** This is the window asking. */
  readonly current: boolean;
}

/** Delivers a tab to another window via main. */
export interface TabTransferPort {
  /** Resolves true once the target adopted every shell; false (or a rejection) means roll back. */
  send(payload: TabPayload, target: TransferTarget): Promise<boolean>;
}
