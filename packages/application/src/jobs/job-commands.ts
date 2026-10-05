import { CommandIds as C } from '@glaceon/domain';
import type { Command, CommandContribution } from '../command/command';
import type { OverlayService } from '../overlay/overlay-service';

export class JobCommands implements CommandContribution {
  readonly #overlay: OverlayService;

  constructor(overlay: OverlayService) {
    this.#overlay = overlay;
  }

  commands(): readonly Command[] {
    return [
      {
        id: C.jobsToggle,
        title: 'Show Running Jobs',
        category: 'View',
        run: () => this.#overlay.toggle('jobs'),
      },
    ];
  }
}
