import { CommandIds, type KeyInput } from '@glaceon/domain';
import { describe, expect, it, vi } from 'vitest';
import { CommandRegistry } from '../command/command-registry';
import { ObservableStore } from '../store/store';
import { ContextKeys } from './context-keys';
import { KeybindingResolver } from './keybinding-resolver';
import { KeybindingService } from './keybinding-service';
import type { KeybindingEntry } from '@glaceon/domain';

const key = (over: Partial<KeyInput>): KeyInput => ({
  key: 'd',
  code: 'KeyD',
  metaKey: true,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...over,
});

describe('KeybindingResolver', () => {
  it('lets later user bindings override defaults and labels commands', () => {
    const resolver = new KeybindingResolver([{ key: 'cmd+e', command: CommandIds.paneSplitRight }]);
    expect(resolver.labelFor(CommandIds.paneSplitRight)).toBe('⌘E');
    expect(resolver.labelFor(CommandIds.tabSelect, 3)).toBe('⌘3');
    expect(resolver.labelFor('nope')).toBeUndefined();
  });

  it('removes bindings with "-command", optionally only for one key', () => {
    const all = new KeybindingResolver([{ key: '', command: `-${CommandIds.tabNext}` }]);
    expect(all.labelFor(CommandIds.tabNext)).toBeUndefined();
    const one = new KeybindingResolver([{ key: 'ctrl+tab', command: `-${CommandIds.tabNext}` }]);
    expect(one.labelFor(CommandIds.tabNext)).toBe('⇧⌘]');
  });

  it('collects problems for invalid keys and when clauses', () => {
    const resolver = new KeybindingResolver(
      [
        { key: 'hyper+x', command: 'a' },
        { key: 'cmd+x', command: 'b', when: 'a &&' },
      ],
      [],
    );
    expect(resolver.problems).toHaveLength(2);
    expect(resolver.all()).toHaveLength(0);
  });
});

function setup(user: KeybindingEntry[] = []) {
  const registry = new CommandRegistry();
  const context = new ContextKeys();
  const bindings = new ObservableStore<readonly KeybindingEntry[]>(user);
  const service = new KeybindingService({ registry, context, userBindings: bindings });
  return { registry, context, bindings, service };
}

describe('KeybindingService', () => {
  it('runs the bound command and reports whether the key was handled', () => {
    const { registry, service } = setup();
    const split = vi.fn();
    registry.register({ id: CommandIds.paneSplitRight, title: 'Split', run: split });

    expect(service.handleKey(key({}))).toBe(true);
    expect(split).toHaveBeenCalledOnce();
    expect(service.handleKey(key({ key: 'Meta', code: 'MetaLeft' }))).toBe(false);
    expect(service.handleKey(key({ key: 'q', code: 'KeyQ' }))).toBe(false);
  });

  it('does not swallow keys bound to commands that are not registered', () => {
    const { service } = setup();
    expect(service.handleKey(key({}))).toBe(false);
  });

  it('honours when clauses and the physical-key fallback', () => {
    const { registry, context, service } = setup();
    const clear = vi.fn();
    registry.register({ id: CommandIds.terminalClear, title: 'Clear', run: clear });
    const cmdK = key({ key: 'k', code: 'KeyK' });
    expect(service.handleKey(cmdK)).toBe(false);
    context.set('terminalFocus', true);
    expect(service.handleKey(cmdK)).toBe(true);

    const previous = vi.fn();
    registry.register({ id: CommandIds.tabPrevious, title: 'Prev', run: previous });
    service.handleKey(key({ key: '{', code: 'BracketLeft', shiftKey: true }));
    expect(previous).toHaveBeenCalledOnce();
  });

  it('passes binding args and follows user binding changes', () => {
    const { registry, bindings, service } = setup();
    const select = vi.fn();
    registry.register({ id: CommandIds.tabSelect, title: 'Select', run: select });
    service.handleKey(key({ key: '4', code: 'Digit4' }));
    expect(select).toHaveBeenCalledWith(4);

    bindings.set([{ key: 'ctrl+4', command: CommandIds.tabSelect, args: 1 }]);
    service.handleKey(key({ key: '4', code: 'Digit4', metaKey: false, ctrlKey: true }));
    expect(select).toHaveBeenLastCalledWith(1);
  });
});
