import type { JobsMap, ReadableStore } from '@glaceon/application';
import type { PaneId, ProcessSignal } from '@glaceon/domain';

/** What the job panel and process popover need. */
export interface JobsModel {
  readonly jobs: ReadableStore<JobsMap>;
  /** Starts process polling; the returned function stops it. */
  readonly watch: () => () => void;
  readonly signal: (pid: number, signal: ProcessSignal) => void;
  readonly focusPane: (pane: PaneId) => void;
}

export function formatCpu(percent: number): string {
  return `${percent >= 10 ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

export function formatMemory(kb: number): string {
  if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(1)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(0)} MB`;
  return `${String(kb)} KB`;
}
