import {
  err,
  ok,
  toDisposable,
  type Disposable,
  type PaneId,
  type PartialSettings,
  type Result,
  type Settings,
} from '@glaceon/domain';
import type { TerminalViewRegistry } from '../ports/terminal-view-registry';
import type { WindowPort } from '../ports/window-port';
import type { ProcessInspector } from '../pty-host/process-inspector';
import type { WritableSettingsSource } from '../settings/settings-source';
import type { SettingsWriter } from '../settings/settings-writer';
import type { ObservableStore } from '../store/store';

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

export class FakeSettingsSource implements WritableSettingsSource {
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

  readonly written: { key: keyof Settings; value: unknown }[] = [];
  writeError: string | undefined;

  write<K extends keyof Settings>(key: K, value: Settings[K]): Promise<Result<void, string>> {
    if (this.writeError !== undefined) return Promise.resolve(err(this.writeError));
    this.written.push({ key, value });
    this.next = ok({ ...(this.next.ok ? this.next.value : {}), [key]: value });
    return Promise.resolve(ok(undefined));
  }

  /** Simulates an edit of the settings file. */
  change(next: Result<PartialSettings, string>): void {
    this.next = next;
    this.#onChange?.();
  }
}

/** Applies updates to an in-memory settings store, like main does after writing the file. */
export class FakeSettingsWriter implements SettingsWriter {
  readonly updates: { key: keyof Settings; value: unknown }[] = [];
  failWith: string | undefined;
  readonly #store: ObservableStore<Settings>;

  constructor(store: ObservableStore<Settings>) {
    this.#store = store;
  }

  update<K extends keyof Settings>(key: K, value: Settings[K]): Promise<Result<void, string>> {
    if (this.failWith !== undefined) return Promise.resolve(err(this.failWith));
    this.updates.push({ key, value });
    this.#store.update((settings) => ({ ...settings, [key]: value }));
    return Promise.resolve(ok(undefined));
  }
}
