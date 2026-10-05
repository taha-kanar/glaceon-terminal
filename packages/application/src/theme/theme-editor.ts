import {
  activeTheme,
  ANSI_COLOR_NAMES,
  availableThemes,
  cloneTheme,
  isHexColor,
  ok,
  themeIdFor,
  type AnsiColorName,
  type HexColor,
  type Result,
  type Settings,
  type Theme,
  type ThemeColors,
} from '@glaceon/domain';
import type { SettingsWriter } from '../settings/settings-writer';
import { computed, ObservableStore, type ReadableStore } from '../store/store';

export type ThemeColorKey = Exclude<keyof ThemeColors, 'ansi'> | AnsiColorName;

const ANSI = new Set<string>(ANSI_COLOR_NAMES);

export interface ThemeEditorDeps {
  readonly settings: ReadableStore<Settings>;
  readonly writer: SettingsWriter;
}

/**
 * Edits a custom theme with a live preview: while a draft exists, `theme` shows the draft
 * instead of the configured theme. Saving writes `customThemes` and selects the theme.
 */
export class ThemeEditor {
  readonly #deps: ThemeEditorDeps;
  readonly #draft = new ObservableStore<Theme | undefined>(undefined);
  /** The theme to render: the draft while editing, else the configured one. */
  readonly theme: ReadableStore<Theme>;

  constructor(deps: ThemeEditorDeps) {
    this.#deps = deps;
    this.theme = computed(
      [deps.settings, this.#draft],
      () => this.#draft.get() ?? activeTheme(deps.settings.get()),
    );
  }

  get draft(): ReadableStore<Theme | undefined> {
    return this.#draft;
  }

  /** Custom themes are edited in place; built-in ones are copied first. */
  begin(baseId?: string): void {
    const settings = this.#deps.settings.get();
    const themes = availableThemes(settings);
    const base = themes.find((theme) => theme.id === baseId) ?? activeTheme(settings);
    if (settings.customThemes.some((theme) => theme.id === base.id)) {
      this.#draft.set(cloneTheme(base, { id: base.id, name: base.name }));
      return;
    }
    const name = `${base.name} Copy`;
    const taken = new Set(themes.map((theme) => theme.id));
    this.#draft.set(cloneTheme(base, { id: themeIdFor(name, taken), name }));
  }

  setColor(key: ThemeColorKey, color: HexColor): void {
    const draft = this.#draft.get();
    if (draft === undefined || !isHexColor(color)) return;
    const colors: ThemeColors = ANSI.has(key)
      ? { ...draft.colors, ansi: { ...draft.colors.ansi, [key]: color } }
      : { ...draft.colors, [key]: color };
    this.#draft.set({ ...draft, colors });
  }

  rename(name: string): void {
    const draft = this.#draft.get();
    if (draft !== undefined && name.trim() !== '') this.#draft.set({ ...draft, name: name.trim() });
  }

  cancel(): void {
    this.#draft.set(undefined);
  }

  async save(): Promise<Result<void, string>> {
    const draft = this.#draft.get();
    if (draft === undefined) return ok(undefined);
    const custom = this.#deps.settings.get().customThemes;
    const next = custom.some((theme) => theme.id === draft.id)
      ? custom.map((theme) => (theme.id === draft.id ? draft : theme))
      : [...custom, draft];
    const saved = await this.#deps.writer.update('customThemes', next);
    if (!saved.ok) return saved;
    const selected = await this.#deps.writer.update('theme', draft.id);
    if (selected.ok) this.#draft.set(undefined);
    return selected;
  }

  /** Deletes a custom theme; if it was selected, the default theme takes over. */
  async remove(id: string): Promise<Result<void, string>> {
    const settings = this.#deps.settings.get();
    const removed = await this.#deps.writer.update(
      'customThemes',
      settings.customThemes.filter((theme) => theme.id !== id),
    );
    if (!removed.ok || settings.theme !== id) return removed;
    return this.#deps.writer.update('theme', 'tokyo-night');
  }
}
