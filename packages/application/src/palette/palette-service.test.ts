import { DEFAULT_SETTINGS } from '@glaceon/domain';
import { describe, expect, it, vi } from 'vitest';
import { CommandRegistry } from '../command/command-registry';
import { ContextKeys } from '../keybinding/context-keys';
import { KeybindingResolver } from '../keybinding/keybinding-resolver';
import { OverlayService } from '../overlay/overlay-service';
import { ObservableStore } from '../store/store';
import { FakeSettingsWriter } from '../testing';
import { ThemeCommands } from '../theme/theme-commands';
import { PaletteService } from './palette-service';

function setup() {
  const registry = new CommandRegistry();
  const overlay = new OverlayService(new ContextKeys());
  const settings = new ObservableStore(DEFAULT_SETTINGS);
  const writer = new FakeSettingsWriter(settings);
  const themes = new ThemeCommands({ settings, writer, overlay });
  registry.registerContribution(themes);
  const split = vi.fn();
  registry.register({ id: 'pane.splitRight', title: 'Split Right', category: 'Pane', run: split });
  registry.register({ id: 'tab.new', title: 'New Tab', category: 'Tab', run: vi.fn() });
  registry.register({ id: 'hidden', title: 'Hidden', hideInPalette: true, run: vi.fn() });
  const palette = new PaletteService({
    registry,
    providers: [themes],
    keybindings: new ObservableStore(new KeybindingResolver([])),
    overlay,
  });
  return { palette, overlay, split, settings, writer };
}

describe('PaletteService', () => {
  it('lists commands and theme invocations with keybinding labels, hiding hidden ones', () => {
    const { palette } = setup();
    const labels = palette.items('').map((item) => item.label);
    expect(labels).toContain('Pane: Split Right');
    expect(labels).toContain('Theme: Tokyo Night (current)');
    expect(labels).toContain('Theme: Edit Themes…');
    expect(labels).not.toContain('Hidden');
    expect(palette.items('split right')[0]).toMatchObject({
      label: 'Pane: Split Right',
      keybinding: '⌘D',
    });
  });

  it('runs the chosen item, closes the overlay and remembers it as recent', async () => {
    const { palette, overlay, split, settings } = setup();
    overlay.open('palette');
    const [item] = palette.items('split');
    palette.run(item!);
    expect(split).toHaveBeenCalledOnce();
    expect(overlay.state.get()).toBeUndefined();
    expect(palette.items('')[0]?.label).toBe('Pane: Split Right');

    const nord = palette.items('theme nord')[0]!;
    palette.run(nord);
    await Promise.resolve();
    expect(settings.get().theme).toBe('nord');
  });

  it('opens the theme section of the settings panel', () => {
    const { palette, overlay } = setup();
    palette.run(palette.items('edit themes')[0]!);
    expect(overlay.state.get()).toEqual({ kind: 'settings', target: 'themes' });
  });
});
