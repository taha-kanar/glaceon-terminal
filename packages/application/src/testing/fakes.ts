import {
  ok,
  toDisposable,
  type Disposable,
  type PaneId,
  type PartialSettings,
  type Result,
} from '@glaceon/domain';
import type { TerminalViewRegistry } from '../ports/terminal-view-registry';
import type { WindowPort } from '../ports/window-port';
import type { ProcessInspector } from '../pty-host/process-inspector';
import type { SettingsSource } from '../settings/settings-source';

export class FakeWindowPort implements WindowPort {
  newWindows = 0;
  closed = 0;
  settingsOpened = 0;

  newWindow(): void {
    this.newWindows++;
  }

  close(): void {
    this.closed++;
  }

  openSettingsFile(): void {
    this.settingsOpened++;
  }
}

export class FakeTerminalViewRegistry implements TerminalViewRegistry {
  readonly released: PaneId[] = [];
  readonly visibility = new Map<PaneId, boolean>();

  setVisible(pane: PaneId, visible: boolean): void {
    this.visibility.set(pane, visible);
  }

  release(pane: PaneId): void {
    this.released.push(pane);
  }
}

export class FakeProcessInspector implements ProcessInspector {
  readonly cwds = new Map<number, string>();
  readonly names = new Map<number, string>();

  cwdOf(pid: number): Promise<string | undefined> {
    return Promise.resolve(this.cwds.get(pid));
  }

  nameOf(pid: number): Promise<string | undefined> {
    return Promise.resolve(this.names.get(pid));
  }
}

export class FakeSettingsSource implements SettingsSource {
  next: Result<PartialSettings, string> = ok({});
  #onChange: (() => void) | undefined;

  read(): Promise<Result<PartialSettings, string>> {
    return Promise.resolve(this.next);
  }

  watch(onChange: () => void): Disposable {
    this.#onChange = onChange;
    return toDisposable(() => {
      this.#onChange = undefined;
    });
  }

  /** Simulates an edit of the settings file. */
  change(next: Result<PartialSettings, string>): void {
    this.next = next;
    this.#onChange?.();
  }
}
