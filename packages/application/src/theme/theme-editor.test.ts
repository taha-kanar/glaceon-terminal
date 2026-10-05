import { DEFAULT_SETTINGS, type Settings } from '@glaceon/domain';
import { describe, expect, it } from 'vitest';
import { ObservableStore } from '../store/store';
import { FakeSettingsWriter } from '../testing';
import { ThemeEditor } from './theme-editor';

function setup(overrides: Partial<Settings> = {}) {
  const settings = new ObservableStore<Settings>({ ...DEFAULT_SETTINGS, ...overrides });
  const writer = new FakeSettingsWriter(settings);
  const editor = new ThemeEditor({ settings, writer });
  return { settings, writer, editor };
}

describe('ThemeEditor', () => {
  it('previews a copy of a built-in theme and saves it as the selected custom theme', async () => {
    const { settings, editor } = setup();
    expect(editor.theme.get().id).toBe('tokyo-night');
    editor.begin('nord');
    expect(editor.draft.get()).toMatchObject({ id: 'nord-copy', name: 'Nord Copy' });
    editor.setColor('red', '#ff0000');
    editor.setColor('background', '#101010');
    editor.setColor('blue', 'not a color');
    editor.rename('  My Nord ');
    expect(editor.theme.get().colors.ansi.red).toBe('#ff0000');
    expect(editor.theme.get().colors.background).toBe('#101010');

    expect((await editor.save()).ok).toBe(true);
    expect(editor.draft.get()).toBeUndefined();
    expect(settings.get().theme).toBe('nord-copy');
    expect(settings.get().customThemes[0]).toMatchObject({ name: 'My Nord', id: 'nord-copy' });
    expect(editor.theme.get().colors.ansi.red).toBe('#ff0000');
  });

  it('edits custom themes in place and can delete them', async () => {
    const { settings, editor } = setup();
    editor.begin('dracula');
    await editor.save();
    editor.begin('dracula-copy');
    expect(editor.draft.get()?.id).toBe('dracula-copy');
    editor.setColor('cursor', '#00ff00');
    await editor.save();
    expect(settings.get().customThemes).toHaveLength(1);

    await editor.remove('dracula-copy');
    expect(settings.get().customThemes).toEqual([]);
    expect(settings.get().theme).toBe('tokyo-night');
  });

  it('keeps the draft when saving fails and discards it on cancel', async () => {
    const { writer, editor } = setup();
    editor.begin();
    writer.failWith = 'disk full';
    expect(await editor.save()).toEqual({ ok: false, error: 'disk full' });
    expect(editor.draft.get()).toBeDefined();
    editor.cancel();
    expect(editor.draft.get()).toBeUndefined();
    expect((await editor.save()).ok).toBe(true);
  });
});
