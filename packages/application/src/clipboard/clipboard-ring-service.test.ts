import { err, ok, type Snippet } from '@glaceon/domain';
import { describe, expect, it } from 'vitest';
import { ManualScheduler } from '../testing';
import { SnippetLibrary } from '../snippet/snippet-library';
import { ClipboardRingService } from './clipboard-ring-service';

describe('ClipboardRingService', () => {
  it('records copies from anywhere (polled) and through the app (at once)', async () => {
    const clipboard = {
      text: 'initial',
      readText: () => Promise.resolve(clipboard.text),
      writeText: (t: string) => {
        clipboard.text = t;
        return Promise.resolve();
      },
    };
    const settle = async () => {
      for (let i = 0; i < 5; i++) await Promise.resolve();
    };
    const scheduler = new ManualScheduler();
    const service = new ClipboardRingService({ clipboard, scheduler });
    await service.start();
    expect(service.ring.get()).toEqual(['initial']);
    clipboard.text = 'from another app';
    scheduler.advance(1000);
    await settle();
    await service.copy('from a terminal');
    scheduler.advance(1000);
    await settle();
    expect(service.ring.get()).toEqual(['from a terminal', 'from another app', 'initial']);
    expect(clipboard.text).toBe('from a terminal');
    service.dispose();
    clipboard.text = 'ignored';
    scheduler.advance(5000);
    await settle();
    expect(service.ring.get()).toHaveLength(3);
  });
});

describe('SnippetLibrary', () => {
  it('keeps the last good snippets when the file breaks', async () => {
    const snippet: Snippet = { name: 'ssh', body: 'ssh {{host}}' };
    let next: ReturnType<typeof ok<readonly Snippet[]>> | ReturnType<typeof err<string>> = ok([
      snippet,
    ]);
    let changed: () => void = () => undefined;
    const library = new SnippetLibrary({
      read: () => Promise.resolve(next),
      watch: (onChange) => {
        changed = onChange;
        return { dispose: () => undefined };
      },
    });
    await library.start();
    expect(library.state.get()).toEqual({ snippets: [snippet] });
    next = err('Unexpected token at line 3');
    changed();
    await Promise.resolve();
    await Promise.resolve();
    expect(library.state.get()).toEqual({
      snippets: [snippet],
      problem: 'Unexpected token at line 3',
    });
    library.dispose();
  });
});
