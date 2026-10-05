import { KeybindingResolver, ObservableStore, type Command } from '@glaceon/application';
import { DEFAULT_SETTINGS, ok, type Settings, type Theme } from '@glaceon/domain';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { click, render } from '../testing/render';
import { SETTINGS_SECTIONS } from './sections';
import type { SettingsPanelModel } from './settings-panel-model';
import { SettingsPanel } from './SettingsPanel';

function model() {
  const settings = new ObservableStore<Settings>(DEFAULT_SETTINGS);
  const draft = new ObservableStore<Theme | undefined>(undefined);
  const update = vi.fn((key: keyof Settings, value: unknown) => {
    settings.update((s) => ({ ...s, [key]: value }));
    return Promise.resolve(ok(undefined));
  });
  const commands: Command[] = [
    { id: 'pane.splitRight', title: 'Split Right', category: 'Pane', run: vi.fn() },
    { id: 'tab.new', title: 'New Tab', category: 'Tab', run: vi.fn() },
  ];
  const setCapture = vi.fn();
  const quakeStatus = new ObservableStore<{ registered: boolean; error?: string } | undefined>(
    undefined,
  );
  const value: SettingsPanelModel = {
    settings,
    update,
    themes: {
      draft,
      begin: vi.fn(),
      setColor: vi.fn(),
      rename: vi.fn(),
      save: vi.fn(() => Promise.resolve(ok(undefined))),
      cancel: vi.fn(),
      remove: vi.fn(() => Promise.resolve(ok(undefined))),
    },
    keybindings: {
      resolver: new ObservableStore(new KeybindingResolver([])),
      commands: () => commands,
      setCapture,
    },
    openSettingsFile: vi.fn(),
    chooseBackgroundImage: vi.fn(() => Promise.resolve(undefined)),
    quakeStatus,
  };
  return { value, update, setCapture, settings, quakeStatus };
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

const tabNamed = (container: Element, name: string): Element | null =>
  [...container.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent === name) ?? null;

describe('SettingsPanel', () => {
  it('shows why the quake shortcut is not active', () => {
    const { value, quakeStatus } = model();
    const { container, unmount } = render(
      <SettingsPanel
        model={value}
        sections={SETTINGS_SECTIONS}
        initialSection={undefined}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-testid="quake-error"]')).toBeNull();
    act(() => {
      quakeStatus.set({ registered: false, error: 'ctrl+q is already used' });
    });
    expect(container.querySelector('[data-testid="quake-error"]')?.textContent).toBe(
      'ctrl+q is already used',
    );
    unmount();
  });

  it('opens the requested section and switches sections', () => {
    const { value } = model();
    const { container, unmount } = render(
      <SettingsPanel
        model={value}
        sections={SETTINGS_SECTIONS}
        initialSection="themes"
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector('[aria-selected="true"]')?.textContent).toBe('Themes');
    expect(container.querySelectorAll('.theme-card')).toHaveLength(7);
    click(container.querySelector('[role="tab"]'));
    expect(container.querySelector('[name="fontSize"]')).not.toBeNull();
    unmount();
  });

  it('picks a background image and shows its options', async () => {
    const { value, update } = model();
    const choose = vi.fn(() => Promise.resolve('/Users/me/wall.png'));
    const { container, unmount } = render(
      <SettingsPanel
        model={{ ...value, chooseBackgroundImage: choose }}
        sections={SETTINGS_SECTIONS}
        initialSection="window"
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector('[name="backgroundImageFit"]')).toBeNull();
    click(container.querySelector('[data-testid="choose-background"]'));
    await flush();
    expect(choose).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith('backgroundImage', '/Users/me/wall.png');
    click(container.querySelector('[name="backgroundBlur"]'));
    expect(update).toHaveBeenCalledWith('backgroundBlur', true);
    unmount();
  });

  it('writes toggles and selects themes', async () => {
    const { value, update } = model();
    const { container, unmount } = render(
      <SettingsPanel
        model={value}
        sections={SETTINGS_SECTIONS}
        initialSection={undefined}
        onClose={vi.fn()}
      />,
    );
    click(container.querySelector('[name="cursorBlink"]'));
    expect(update).toHaveBeenCalledWith('cursorBlink', false);
    click(tabNamed(container, 'Themes'));
    click(container.querySelector('[data-testid="theme-nord"]'));
    await flush();
    expect(update).toHaveBeenCalledWith('theme', 'nord');
    expect(
      container.querySelector('[data-testid="theme-nord"]')?.getAttribute('aria-checked'),
    ).toBe('true');
    unmount();
  });

  it('records a new keybinding with shortcuts suspended', async () => {
    const { value, update, setCapture } = model();
    const { container, unmount } = render(
      <SettingsPanel
        model={value}
        sections={SETTINGS_SECTIONS}
        initialSection="keybindings"
        onClose={vi.fn()}
      />,
    );
    const row = container.querySelector('[data-testid="keybinding-pane.splitRight"]')!;
    expect(row.querySelector('.keycap')?.textContent).toBe('⌘D');
    click(row.querySelector('.keycap'));
    const recorder = row.querySelector<HTMLInputElement>('.recorder')!;
    act(() => {
      recorder.dispatchEvent(new FocusEvent('focus'));
      recorder.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', metaKey: true, bubbles: true }),
      );
    });
    await flush();
    expect(setCapture).toHaveBeenCalledWith(true);
    expect(update).toHaveBeenCalledWith('keybindings', [
      { key: '', command: '-pane.splitRight' },
      { key: 'cmd+e', command: 'pane.splitRight' },
    ]);
    unmount();
  });

  it('shows write errors and closes with Escape', async () => {
    const { value } = model();
    const failing = {
      ...value,
      update: () => Promise.resolve({ ok: false as const, error: 'disk full' }),
    };
    const onClose = vi.fn();
    const { container, unmount } = render(
      <SettingsPanel
        model={failing}
        sections={SETTINGS_SECTIONS}
        initialSection={undefined}
        onClose={onClose}
      />,
    );
    click(container.querySelector('[name="cursorBlink"]'));
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('disk full');
    act(() => {
      container
        .querySelector('.drawer')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalled();
    unmount();
  });
});
