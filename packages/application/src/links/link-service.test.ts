import { asPaneId, err, ok } from '@glaceon/domain';
import { describe, expect, it, vi } from 'vitest';
import { SessionManager } from '../terminal/session-manager';
import { TerminalSessionService } from '../terminal/terminal-session-service';
import { FakePtyPort, FakeTerminalView, ManualScheduler, SequentialIdGenerator } from '../testing';
import { ToastService } from '../toast/toast-service';
import type { LinkOpener } from './link-opener';
import { LinkService } from './link-service';

async function setup() {
  const pty = new FakePtyPort();
  pty.cwdResult = '/repo';
  const sessions = new SessionManager(
    new TerminalSessionService({ pty, ids: new SequentialIdGenerator() }),
  );
  await sessions.open(asPaneId('p'), new FakeTerminalView());
  const opener = {
    openUrl: vi.fn<LinkOpener['openUrl']>(() => Promise.resolve(ok(undefined))),
    openFile: vi.fn<LinkOpener['openFile']>(() => Promise.resolve(ok(undefined))),
  };
  const scheduler = new ManualScheduler();
  const toasts = new ToastService(scheduler);
  return { opener, toasts, scheduler, links: new LinkService({ opener, sessions, toasts }) };
}

describe('LinkService', () => {
  it('opens URLs and resolves relative files against the pane cwd', async () => {
    const { opener, links } = await setup();
    await links.open(asPaneId('p'), { kind: 'url', start: 0, end: 1, url: 'https://x.dev' });
    expect(opener.openUrl).toHaveBeenCalledWith('https://x.dev');
    await links.open(asPaneId('p'), {
      kind: 'file',
      start: 0,
      end: 1,
      path: 'src/a.ts',
      line: 3,
      column: 2,
    });
    expect(opener.openFile).toHaveBeenLastCalledWith({
      path: 'src/a.ts',
      cwd: '/repo',
      line: 3,
      column: 2,
    });
    await links.open(asPaneId('p'), { kind: 'file', start: 0, end: 1, path: '/etc/hosts' });
    expect(opener.openFile).toHaveBeenLastCalledWith({ path: '/etc/hosts' });
  });

  it('shows failures as error toasts that disappear', async () => {
    const { opener, links, toasts, scheduler } = await setup();
    opener.openFile.mockResolvedValueOnce(err('Editor "code" not found'));
    await links.open(asPaneId('p'), { kind: 'file', start: 0, end: 1, path: '~/x' });
    expect(toasts.toasts.get()).toEqual([
      { id: 1, message: 'Editor "code" not found', kind: 'error' },
    ]);
    scheduler.advance(5000);
    expect(toasts.toasts.get()).toEqual([]);
  });

  it('keeps at most three toasts', async () => {
    const { toasts } = await setup();
    for (const n of [1, 2, 3, 4]) toasts.show(`t${String(n)}`);
    expect(toasts.toasts.get().map((t) => t.message)).toEqual(['t2', 't3', 't4']);
  });
});
