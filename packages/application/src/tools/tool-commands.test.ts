import { CommandIds, type Snippet } from '@glaceon/domain';
import { describe, expect, it, vi } from 'vitest';
import { CommandRegistry } from '../command/command-registry';
import { ContextKeys } from '../keybinding/context-keys';
import { OverlayService } from '../overlay/overlay-service';
import { ObservableStore } from '../store/store';
import { ToolCommands } from './tool-commands';

function setup() {
  const overlay = new OverlayService(new ContextKeys());
  const paste = vi.fn();
  const snippets = new ObservableStore<readonly Snippet[]>([
    { name: 'ls', body: 'ls -la' },
    { name: 'ssh', body: 'ssh {{host}}' },
  ]);
  const tools = new ToolCommands({
    overlay,
    ring: new ObservableStore(['newest', 'older']),
    snippets,
    paste,
    openSnippetsFile: vi.fn(),
  });
  const registry = new CommandRegistry();
  registry.registerContribution(tools);
  return { overlay, paste, tools, registry };
}

describe('ToolCommands', () => {
  it('pastes ring items by position', () => {
    const { registry, paste, overlay } = setup();
    registry.execute(CommandIds.clipboardPaste, 1);
    registry.execute(CommandIds.clipboardPaste, 7);
    expect(paste.mock.calls).toEqual([['older']]);
    registry.execute(CommandIds.clipboardShowRing);
    expect(overlay.state.get()).toEqual({ kind: 'clipboard' });
  });

  it('pastes plain snippets and asks for placeholders first', () => {
    const { registry, paste, overlay, tools } = setup();
    registry.execute(CommandIds.snippetsInsert, 'ls');
    expect(paste).toHaveBeenCalledWith('ls -la');
    registry.execute(CommandIds.snippetsInsert, 'ssh');
    expect(overlay.state.get()).toEqual({ kind: 'snippets', target: 'ssh' });
    tools.insert('missing');
    expect(tools.invocations().map((i) => i.title)).toEqual(['ls', 'ssh']);
  });
});
