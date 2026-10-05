import { DEFAULT_SETTINGS, type Settings } from '@glaceon/domain';
import { describe, expect, it } from 'vitest';
import { ObservableStore } from '../store/store';
import { QuakeController, quakeBounds } from './quake-controller';
import type { GlobalShortcutPort, QuakePanel, ScreenRect } from './quake-ports';

class FakePanel implements QuakePanel {
  visible = false;
  focused = false;
  shownAt: ScreenRect | undefined;
  show(bounds: ScreenRect): void {
    this.visible = true;
    this.focused = true;
    this.shownAt = bounds;
  }
  hide(): void {
    this.visible = false;
    this.focused = false;
  }
}

class FakeShortcuts implements GlobalShortcutPort {
  readonly owned = new Map<string, () => void>();
  taken = new Set<string>();
  register(accelerator: string, callback: () => void): boolean {
    if (this.taken.has(accelerator)) return false;
    this.owned.set(accelerator, callback);
    return true;
  }
  unregister(accelerator: string): void {
    this.owned.delete(accelerator);
  }
}

function setup(over: Partial<Settings> = {}) {
  const panel = new FakePanel();
  const shortcuts = new FakeShortcuts();
  const settings = new ObservableStore<Settings>({ ...DEFAULT_SETTINGS, ...over });
  const activation = {
    active: false,
    yielded: 0,
    isActive: () => activation.active,
    yieldFocus: () => activation.yielded++,
  };
  const controller = new QuakeController({
    panel: () => panel,
    screen: { workAreaAtPointer: () => ({ x: 1440, y: 25, width: 1920, height: 1055 }) },
    shortcuts,
    activation,
    settings,
    toAccelerator: (chord) => `${chord.ctrl ? 'Ctrl+' : ''}${chord.key}`,
  });
  controller.start();
  return { panel, shortcuts, settings, activation, controller };
}

describe('QuakeController', () => {
  it('registers the shortcut, which drops the panel down on the pointer screen and back', () => {
    const { panel, shortcuts, activation, controller } = setup();
    expect(controller.status.get()).toEqual({ registered: true });
    shortcuts.owned.get('Ctrl+`')?.();
    expect(panel.shownAt).toEqual({ x: 1440, y: 25, width: 1920, height: 475 });
    shortcuts.owned.get('Ctrl+`')?.();
    expect(panel.visible).toBe(false);
    // Another app was frontmost, so it gets focus back.
    expect(activation.yielded).toBe(1);
  });

  it('keeps focus in the app when it was already frontmost, and hides on blur', () => {
    const { panel, activation, controller } = setup();
    activation.active = true;
    controller.show();
    controller.blurred();
    expect(panel.visible).toBe(false);
    expect(activation.yielded).toBe(0);
    controller.blurred();
  });

  it('shows itself again when visible but unfocused', () => {
    const { panel, controller } = setup();
    controller.show();
    panel.focused = false;
    controller.toggle();
    expect(panel.visible).toBe(true);
  });

  it('reports shortcuts it cannot register and follows settings', () => {
    const { shortcuts, settings, controller } = setup({ quakeShortcut: 'hyper+x' });
    expect(controller.status.get().error).toContain('not a valid shortcut');
    shortcuts.taken.add('Ctrl+q');
    settings.set({ ...settings.get(), quakeShortcut: 'ctrl+q' });
    expect(controller.status.get()).toEqual({
      registered: false,
      error: 'ctrl+q is already used by macOS or another app.',
    });
    settings.set({ ...settings.get(), quakeShortcut: 'ctrl+`' });
    expect(shortcuts.owned.has('Ctrl+`')).toBe(true);
    settings.set({ ...settings.get(), quakeEnabled: false });
    expect(shortcuts.owned.size).toBe(0);
    expect(controller.status.get()).toEqual({ registered: false });
    controller.dispose();
  });

  it('clamps the height', () => {
    const area = { x: 0, y: 0, width: 100, height: 1000 };
    expect(quakeBounds(area, 0.05).height).toBe(200);
    expect(quakeBounds(area, 3).height).toBe(1000);
  });
});
