import { describe, expect, it, vi } from 'vitest';
import { CommandRegistry } from './command-registry';

describe('CommandRegistry', () => {
  it('registers, executes with args and unregisters commands', () => {
    const registry = new CommandRegistry();
    const run = vi.fn();
    const changed = vi.fn();
    registry.onDidChange(changed);
    const registration = registry.register({ id: 'x', title: 'X', run });

    expect(registry.execute('x', 3)).toBe(true);
    expect(run).toHaveBeenCalledWith(3);
    expect(registry.list().map((c) => c.id)).toEqual(['x']);

    registration.dispose();
    expect(registry.execute('x')).toBe(false);
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('rejects duplicate ids', () => {
    const registry = new CommandRegistry();
    registry.register({ id: 'x', title: 'X', run: () => undefined });
    expect(() => registry.register({ id: 'x', title: 'X', run: () => undefined })).toThrow();
  });

  it('registers contributions and reports sync and async failures', async () => {
    const registry = new CommandRegistry();
    const failures = vi.fn();
    registry.onDidFail(failures);
    const contribution = registry.registerContribution({
      commands: () => [
        {
          id: 'sync',
          title: 'S',
          run: () => {
            throw new Error('sync');
          },
        },
        { id: 'async', title: 'A', run: () => Promise.reject(new Error('async')) },
      ],
    });
    registry.execute('sync');
    registry.execute('async');
    await Promise.resolve();
    expect(failures.mock.calls.map(([f]) => (f as { commandId: string }).commandId)).toEqual([
      'sync',
      'async',
    ]);
    contribution.dispose();
    expect(registry.has('sync')).toBe(false);
  });
});
