import { describe, expect, it, vi } from 'vitest';
import { CommandRegistry } from '../command/command-registry';
import { ContextKeys } from '../keybinding/context-keys';
import { OverlayCommands } from './overlay-commands';
import { OverlayService } from './overlay-service';

describe('OverlayService', () => {
  it('opens one overlay at a time and maintains context keys', () => {
    const context = new ContextKeys();
    const overlay = new OverlayService(context);
    const closed = vi.fn();
    overlay.onDidClose(closed);

    overlay.open('palette');
    expect(context.get()).toMatchObject({ overlayOpen: true, paletteOpen: true });
    overlay.open('settings', 'themes');
    expect(overlay.state.get()).toEqual({ kind: 'settings', target: 'themes' });
    overlay.toggle('settings');
    expect(overlay.state.get()).toBeUndefined();
    expect(context.get()).toMatchObject({ overlayOpen: false, settingsOpen: false });
    expect(closed).toHaveBeenCalledWith('settings');
    overlay.close();
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('exposes palette and settings commands', () => {
    const overlay = new OverlayService(new ContextKeys());
    const registry = new CommandRegistry();
    registry.registerContribution(new OverlayCommands(overlay));
    registry.execute('palette.toggle');
    expect(overlay.isOpen('palette')).toBe(true);
    registry.execute('settings.open');
    expect(overlay.isOpen('settings')).toBe(true);
  });
});
