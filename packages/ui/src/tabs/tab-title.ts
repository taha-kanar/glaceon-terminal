import type { SessionInfoMap } from '@glaceon/application';
import type { Tab } from '@glaceon/domain';

/** A tab is named after what runs in its active pane: `zsh`, `vim`, `npm` … */
export function tabTitle(tab: Tab, sessions: SessionInfoMap): string {
  const info = sessions.get(tab.activePane);
  if (info?.exit !== undefined) return `${info.process ?? info.shell ?? 'shell'} (exited)`;
  return info?.process ?? info?.shell ?? 'shell';
}
