import { CommandIds as C } from '@glaceon/domain';
import type { Command, CommandContribution } from '../command/command';
import type { OverlayService } from './overlay-service';

/** Opening the palette and the settings panel. */
export class OverlayCommands implements CommandContribution {
  readonly #overlay: OverlayService;

  constructor(overlay: OverlayService) {
    this.#overlay = overlay;
  }

  commands(): readonly Command[] {
    const overlay = this.#overlay;
    return [
      {
        id: C.paletteToggle,
        title: 'Command Palette',
        category: 'View',
        run: () => overlay.toggle('palette'),
      },
      {
        id: C.settingsOpen,
        title: 'Open Settings',
        category: 'Settings',
        run: () => overlay.toggle('settings'),
      },
    ];
  }
}
