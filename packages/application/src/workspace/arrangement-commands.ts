import { CommandIds as C, LAYOUT_TEMPLATES, TAB_COLORS, type TabColor } from '@glaceon/domain';
import type {
  Command,
  CommandContribution,
  CommandInvocation,
  DynamicCommandProvider,
} from '../command/command';
import type { ArrangementService } from './arrangement-service';

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const isTabColor = (value: unknown): value is TabColor =>
  TAB_COLORS.some((color) => color === value);

/** Commands for the active tab's metadata, groups and layout; one palette entry per layout and color. */
export class ArrangementCommands implements CommandContribution, DynamicCommandProvider {
  readonly #service: ArrangementService;

  constructor(service: ArrangementService) {
    this.#service = service;
  }

  commands(): readonly Command[] {
    const service = this.#service;
    return [
      { id: C.tabRename, title: 'Rename Tab…', category: 'Tab', run: () => service.beginRename() },
      {
        id: C.tabTogglePin,
        title: 'Pin / Unpin Tab',
        category: 'Tab',
        run: () => service.togglePin(),
      },
      {
        id: C.tabToggleLock,
        title: 'Lock / Unlock Tab',
        category: 'Tab',
        run: () => service.toggleLock(),
      },
      {
        id: C.tabNewGroup,
        title: 'Add Tab to New Group',
        category: 'Tab',
        run: () => service.newGroup(),
      },
      {
        id: C.tabRemoveFromGroup,
        title: 'Remove Tab from Group',
        category: 'Tab',
        run: () => service.setGroup(undefined),
      },
      {
        id: C.tabSetColor,
        title: 'Set Tab Color',
        category: 'Tab',
        hideInPalette: true,
        run: (args) => service.setColor(isTabColor(args) ? args : undefined),
      },
      {
        id: C.paneMoveToNewTab,
        title: 'Move Pane to New Tab',
        category: 'Pane',
        run: () => service.paneToNewTab(),
      },
      {
        id: C.layoutApply,
        title: 'Apply Layout',
        category: 'Layout',
        hideInPalette: true,
        run: (args) => (typeof args === 'string' ? service.applyLayout(args) : undefined),
      },
    ];
  }

  invocations(): readonly CommandInvocation[] {
    const layouts = LAYOUT_TEMPLATES.map((layout) => ({
      id: `layout:${layout.id}`,
      title:
        layout.slots === undefined ? layout.name : `${layout.name} (${String(layout.slots)} panes)`,
      category: 'Layout',
      command: C.layoutApply,
      args: layout.id,
    }));
    const colors = [...TAB_COLORS, undefined].map((color) => ({
      id: `tab-color:${color ?? 'none'}`,
      title: color === undefined ? 'No Color' : capitalize(color),
      category: 'Tab Color',
      command: C.tabSetColor,
      args: color,
    }));
    return [...layouts, ...colors];
  }
}
