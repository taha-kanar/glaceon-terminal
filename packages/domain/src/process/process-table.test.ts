import { describe, expect, it } from 'vitest';
import {
  cpuPercent,
  depthOf,
  descendants,
  parseCpuTime,
  processName,
  type ProcessInfo,
} from './process-table';

const info = (pid: number, ppid: number): ProcessInfo => ({
  pid,
  ppid,
  name: 'x',
  args: 'x',
  cpu: 0,
  memoryKb: 0,
  foreground: false,
  stopped: false,
});

describe('process table helpers', () => {
  it('names processes from their command line', () => {
    expect(processName('/usr/bin/vim a b')).toBe('vim');
    expect(processName('-zsh')).toBe('zsh');
    expect(processName('node')).toBe('node');
    expect(processName('  ')).toBe('?');
  });

  it('parses ps CPU times', () => {
    expect(parseCpuTime('0:01.50')).toBe(1500);
    expect(parseCpuTime('5:36.57')).toBe(336_570);
    expect(parseCpuTime('1:00:00')).toBe(3_600_000);
    expect(parseCpuTime('2-01:00:00')).toBe(49 * 3_600_000);
    expect(parseCpuTime('garbage')).toBe(0);
  });

  it('computes CPU percent from CPU time deltas', () => {
    expect(cpuPercent(undefined, 500, 1000)).toBe(0);
    expect(cpuPercent(1000, 1500, 1000)).toBe(50);
    expect(cpuPercent(1000, 3000, 1000)).toBe(200);
    expect(cpuPercent(2000, 1000, 1000)).toBe(0);
    expect(cpuPercent(0, 10, 0)).toBe(0);
  });

  it('walks a process tree from its root, parents first', () => {
    const table = [info(1, 0), info(10, 1), info(11, 10), info(12, 1), info(99, 98), info(13, 12)];
    expect(descendants(table, 1).map((p) => p.pid)).toEqual([1, 10, 11, 12, 13]);
    expect(descendants(table, 5)).toEqual([]);
    const tree = descendants(table, 1);
    expect(depthOf(tree, 13)).toBe(2);
    expect(depthOf(tree, 1)).toBe(0);
  });
});
