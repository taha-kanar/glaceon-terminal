import type { PtyExit } from '@glaceon/domain';
import { describe, expect, it } from 'vitest';
import { MacProcessInspector } from './mac-process-inspector';
import { NodePtyProcessFactory } from './node-pty-process';

const factory = new NodePtyProcessFactory();
const base = { cwd: '/tmp', env: { PATH: '/usr/bin:/bin' }, size: { cols: 80, rows: 24 } };

function collect(command: string): Promise<{ output: string; exit: PtyExit }> {
  const ptyProcess = factory.spawn({ ...base, file: '/bin/sh', args: ['-c', command] });
  const decoder = new TextDecoder();
  let output = '';
  ptyProcess.onData((chunk) => {
    expect(chunk).toBeInstanceOf(Uint8Array);
    output += decoder.decode(chunk, { stream: true });
  });
  return new Promise((resolve) => {
    ptyProcess.onExit((exit) => resolve({ output, exit }));
  });
}

describe('NodePtyProcessFactory (real pty)', () => {
  it('streams output bytes and reports the exit code', async () => {
    const { output, exit } = await collect('printf "hi ğüş"; exit 3');

    expect(output).toContain('hi ğüş');
    expect(exit).toEqual({ exitCode: 3 });
  });

  it('starts with the requested size and cwd', async () => {
    const { output } = await collect('stty size; pwd');

    expect(output).toMatch(/24 80/);
    expect(output).toMatch(/\/(private\/)?tmp/);
  });

  it('reports the signal when killed', async () => {
    const ptyProcess = factory.spawn({ ...base, file: '/bin/sh', args: ['-c', 'sleep 30'] });
    const exited = new Promise<PtyExit>((resolve) => ptyProcess.onExit(resolve));

    ptyProcess.kill();

    expect((await exited).signal).toBeGreaterThan(0);
    // Calls after exit are ignored instead of throwing.
    ptyProcess.write('x');
    ptyProcess.resize({ cols: 10, rows: 10 });
    ptyProcess.kill();
  });

  it('reports a missing shell as a failed exit (spawn-helper execs, then fails)', async () => {
    const ptyProcess = factory.spawn({ ...base, file: '/nonexistent/shell', args: [] });
    const exit = await new Promise<PtyExit>((resolve) => ptyProcess.onExit(resolve));

    expect(exit.exitCode).not.toBe(0);
  });
});

describe('NodePtyProcess foreground and flow control', () => {
  it('names the foreground process and can pause and resume output', async () => {
    const ptyProcess = factory.spawn({ ...base, file: '/bin/sh', args: ['-c', 'exec sleep 30'] });
    await expect.poll(() => ptyProcess.foregroundProcess).toBe('sleep');
    ptyProcess.pause();
    ptyProcess.resume();
    const exited = new Promise<PtyExit>((resolve) => ptyProcess.onExit(resolve));
    ptyProcess.kill();
    await exited;
    expect(ptyProcess.foregroundProcess).toBe('');
    ptyProcess.pause();
    ptyProcess.resume();
  });

  it('names an idle shell the way the process inspector does', async () => {
    // macOS /bin/sh becomes bash under the same pid; argv[0] still says /bin/sh.
    const ptyProcess = factory.spawn({ ...base, file: '/bin/sh', args: [] });
    const inspector = new MacProcessInspector();
    // Both names change while the shell starts; once it settles they must agree.
    await expect
      .poll(async () => {
        const foreground = ptyProcess.foregroundProcess;
        const name = await inspector.nameOf(ptyProcess.pid);
        return foreground !== '' && name === ptyProcess.foregroundProcess;
      })
      .toBe(true);
    const exited = new Promise<PtyExit>((resolve) => ptyProcess.onExit(resolve));
    ptyProcess.kill();
    await exited;
  });
});
