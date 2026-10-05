import type { PaneId, TerminalLink } from '@glaceon/domain';
import type { SessionManager } from '../terminal/session-manager';
import type { ToastService } from '../toast/toast-service';
import type { LinkOpener } from './link-opener';

export interface LinkServiceDeps {
  readonly opener: LinkOpener;
  readonly sessions: SessionManager;
  readonly toasts: ToastService;
}

/** Opens a link clicked in a pane; relative paths resolve against that pane's shell cwd. */
export class LinkService {
  readonly #deps: LinkServiceDeps;

  constructor(deps: LinkServiceDeps) {
    this.#deps = deps;
  }

  async open(pane: PaneId, link: TerminalLink): Promise<void> {
    const { opener, sessions, toasts } = this.#deps;
    let result;
    if (link.kind === 'url') {
      result = await opener.openUrl(link.url);
    } else {
      const absolute = link.path.startsWith('/') || link.path.startsWith('~');
      const cwd = absolute ? undefined : await sessions.cwdOf(pane);
      result = await opener.openFile({
        path: link.path,
        ...(cwd === undefined ? {} : { cwd }),
        ...(link.line === undefined ? {} : { line: link.line }),
        ...(link.column === undefined ? {} : { column: link.column }),
      });
    }
    if (!result.ok) toasts.show(result.error, 'error');
  }
}
