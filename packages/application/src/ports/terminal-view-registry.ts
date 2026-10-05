import type { PaneId } from '@glaceon/domain';

/** Owner of the terminal views of a window (the views outlive React re-renders). */
export interface TerminalViewRegistry {
  /** Hidden views may drop expensive resources such as their WebGL context. */
  setVisible(pane: PaneId, visible: boolean): void;
  release(pane: PaneId): void;
}
