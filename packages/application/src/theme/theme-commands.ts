import { availableThemes, CommandIds as C, type Settings } from '@glaceon/domain';
import type {
  Command,
  CommandContribution,
  CommandInvocation,
  DynamicCommandProvider,
} from '../command/command';
import type { OverlayService } from '../overlay/overlay-service';
import type { SettingsWriter } from '../settings/settings-writer';
import type { ReadableStore } from '../store/store';

export interface ThemeCommandsDeps {
  readonly settings: ReadableStore<Settings>;
  readonly writer: SettingsWriter;
  readonly overlay: OverlayService;
}

/** Theme selection and editing, plus one palette entry per available theme. */
export class ThemeCommands implements CommandContribution, DynamicCommandProvider {
  readonly #deps: ThemeCommandsDeps;

  constructor(deps: ThemeCommandsDeps) {
    this.#deps = deps;
  }

  commands(): readonly Command[] {
    const { writer, overlay } = this.#deps;
    return [
      {
        id: C.themeSelect,
        title: 'Select Theme',
        category: 'Theme',
        hideInPalette: true,
        run: async (args) => {
          if (typeof args !== 'string') return;
          const result = await writer.update('theme', args);
          if (!result.ok) throw new Error(result.error);
        },
      },
      {
        id: C.themeEdit,
        title: 'Edit Themes…',
        category: 'Theme',
        run: () => overlay.open('settings', 'themes'),
      },
    ];
  }

  invocations(): readonly CommandInvocation[] {
    const current = this.#deps.settings.get().theme;
    return availableThemes(this.#deps.settings.get()).map((theme) => ({
      id: `theme:${theme.id}`,
      title: theme.id === current ? `${theme.name} (current)` : theme.name,
      category: 'Theme',
      command: C.themeSelect,
      args: theme.id,
    }));
  }
}
