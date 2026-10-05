import { KeybindingResolver } from '@glaceon/application';
import { CommandIds } from '@glaceon/domain';
import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { applicationMenuTemplate, MENU_COMMANDS } from './application-menu';

vi.mock('electron', () => ({ Menu: {} }));

function flatten(items: readonly MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return items.flatMap((item) => [
    item,
    ...(Array.isArray(item.submenu) ? flatten(item.submenu) : []),
  ]);
}

describe('application menu', () => {
  const resolver = new KeybindingResolver([]);
  const run = vi.fn();
  const template = (isDevelopment: boolean): MenuItemConstructorOptions[] =>
    applicationMenuTemplate({
      appName: 'Glaceon Terminal',
      isDevelopment,
      chordFor: (command, args) => resolver.chordFor(command, args),
      run,
    });

  it('only runs built-in commands', () => {
    const known = new Set<string>(Object.values(CommandIds));
    for (const { command } of MENU_COMMANDS) expect(known.has(command)).toBe(true);
  });

  it('shows keybindings as labels without registering them', () => {
    const items = flatten(template(false));
    const find = items.find((item) => item.label === 'Find…');
    expect(find?.accelerator).toBe('Cmd+F');
    expect(find?.registerAccelerator).toBe(false);
    const commandItems = items.filter((item) => item.click !== undefined);
    expect(commandItems).toHaveLength(MENU_COMMANDS.length);
    for (const item of commandItems) expect(item.registerAccelerator).toBe(false);
  });

  it('runs the command of a clicked item', () => {
    const split = flatten(template(false)).find((item) => item.label === 'Split Right');
    (split?.click as () => void)();
    expect(run).toHaveBeenCalledWith(CommandIds.paneSplitRight, undefined);
  });

  it('adds developer tools only in development', () => {
    const roles = (dev: boolean): unknown[] => flatten(template(dev)).map((item) => item.role);
    expect(roles(true)).toContain('toggleDevTools');
    expect(roles(false)).not.toContain('toggleDevTools');
    expect(roles(false)).toEqual(expect.arrayContaining(['about', 'quit', 'windowMenu', 'help']));
  });
});
