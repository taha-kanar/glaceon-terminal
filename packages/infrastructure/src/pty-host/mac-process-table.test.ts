import { describe, expect, it } from 'vitest';
import { MacProcessTable, NodeProcessSignaller, parsePsTable } from './mac-process-table';

describe('parsePsTable', () => {
  it('reads terminal processes and skips daemons and junk', () => {
    const output = [
      ' 2661  2660  2661 3160 Ss     0:00.02   1312 ttys001  /bin/zsh -il',
      ' 3160  2661  3160 3160 S+     5:36.57 595344 ttys001  claude --flag value',
      '    1     0     1    0 Ss    10:00.00  20000 ??       /sbin/launchd',
      'garbage',
      '',
    ].join('\n');
    expect(parsePsTable(output)).toEqual([
      {
        pid: 2661,
        ppid: 2660,
        pgid: 2661,
        tpgid: 3160,
        stat: 'Ss',
        cpuTimeMs: 20,
        memoryKb: 1312,
        tty: 'ttys001',
        args: '/bin/zsh -il',
      },
      expect.objectContaining({ pid: 3160, cpuTimeMs: 336_570, args: 'claude --flag value' }),
    ]);
  });
});

describe('MacProcessTable', () => {
  it('samples the real process table', async () => {
    const rows = await new MacProcessTable().sample();
    expect(Array.isArray(rows)).toBe(true);
    expect(new NodeProcessSignaller().signal(2 ** 30, 'SIGTERM')).toBe(false);
  });
});
