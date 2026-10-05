import {
  computeLayout,
  UNIT_RECT,
  type DividerRect,
  type PaneId,
  type Rect,
  type Tab,
  type TabId,
  type Workspace,
} from '@glaceon/domain';
import type { CSSProperties } from 'react';

export interface PlacedPane {
  readonly pane: PaneId;
  readonly tab: TabId;
  readonly rect: Rect;
  /** On screen: in the active tab and not hidden behind a zoomed pane. */
  readonly visible: boolean;
  /** The active pane of the active tab. */
  readonly focused: boolean;
}

function placeTab(tab: Tab, active: boolean): PlacedPane[] {
  return computeLayout(tab.root).panes.map(({ id, rect }) => {
    const isActivePane = id === tab.activePane;
    return {
      pane: id,
      tab: tab.id,
      rect: tab.zoomed && isActivePane ? UNIT_RECT : rect,
      visible: active && (!tab.zoomed || isActivePane),
      focused: active && isActivePane,
    };
  });
}

/**
 * Every pane of every tab as one flat list. Rendering them all as siblings keyed by pane id
 * means switching tabs or re-splitting never remounts a terminal.
 */
export function placePanes(workspace: Workspace): PlacedPane[] {
  return workspace.tabs.flatMap((tab) => placeTab(tab, tab.id === workspace.activeTab));
}

export function visibleDividers(workspace: Workspace): readonly DividerRect[] {
  const tab = workspace.tabs.find((t) => t.id === workspace.activeTab);
  if (tab === undefined || tab.zoomed) return [];
  return computeLayout(tab.root).dividers;
}

const percent = (value: number): string => `${String(value * 100)}%`;

export function rectStyle(rect: Rect): CSSProperties {
  return {
    left: percent(rect.x),
    top: percent(rect.y),
    width: percent(rect.width),
    height: percent(rect.height),
  };
}

export function dividerStyle(divider: DividerRect): CSSProperties {
  const { region, position } = divider;
  return divider.axis === 'row'
    ? { left: percent(position), top: percent(region.y), height: percent(region.height) }
    : { top: percent(position), left: percent(region.x), width: percent(region.width) };
}
