import type { JobsMap, SessionInfoMap } from '@glaceon/application';
import { ObservableStore } from '@glaceon/application';
import {
  addTab,
  asPaneId,
  asTabId,
  createTab,
  EMPTY_WORKSPACE,
  type ProcessInfo,
} from '@glaceon/domain';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { click, render } from '../testing/render';
import { formatCpu, formatMemory, type JobsModel } from './jobs-model';
import { JobsPanel } from './JobsPanel';
import { ProcessIndicator } from './ProcessPopover';

const a = asPaneId('a');
const workspace = addTab(EMPTY_WORKSPACE, createTab(asTabId('t'), a));
const sessions: SessionInfoMap = new Map([
  [a, { pid: 10, shell: 'zsh', process: 'sleep', busy: true }],
]);
const proc = ([pid, ppid]: [number, number], name: string, cpu: number): ProcessInfo => ({
  pid,
  ppid,
  name,
  args: `${name} 30`,
  cpu,
  memoryKb: 2048,
  foreground: pid !== 10,
  stopped: false,
});

function model(): JobsModel & { stop: ReturnType<typeof vi.fn> } {
  const jobs = new ObservableStore<JobsMap>(new Map());
  const stop = vi.fn();
  return {
    jobs,
    stop,
    watch: vi.fn(() => {
      jobs.set(
        new Map([
          [
            a,
            {
              processes: [proc([10, 1], 'zsh', 0), proc([11, 10], 'sleep', 12.5)],
              cpu: 12.5,
              memoryKb: 4096,
            },
          ],
        ]),
      );
      return stop;
    }),
    signal: vi.fn(),
    focusPane: vi.fn(),
  };
}

describe('jobs views', () => {
  it('formats metrics', () => {
    expect(formatCpu(3.14)).toBe('3.1%');
    expect(formatCpu(55.5)).toBe('56%');
    expect(formatMemory(512)).toBe('512 KB');
    expect(formatMemory(4096)).toBe('4 MB');
    expect(formatMemory(3 * 1024 * 1024)).toBe('3.0 GB');
  });

  it('lists process trees, signals children and stops polling when closed', () => {
    const jobs = model();
    const onClose = vi.fn();
    const { container, unmount } = render(
      <JobsPanel workspace={workspace} sessions={sessions} model={jobs} onClose={onClose} />,
    );
    const rows = container.querySelectorAll<HTMLElement>('[data-testid="job"]');
    expect([...rows].map((r) => r.dataset['name'])).toEqual(['zsh', 'sleep']);
    expect(rows[0]?.querySelector('button')).toBeNull();
    click(rows[1]?.querySelector('button[title^="Terminate"]') ?? null);
    expect(jobs.signal).toHaveBeenCalledWith(11, 'SIGTERM');
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalled();
    unmount();
    expect(jobs.stop).toHaveBeenCalled();
  });

  it('polls only while the popover is open', () => {
    const jobs = model();
    const { container, unmount } = render(
      <ProcessIndicator workspace={workspace} sessions={sessions} model={jobs} />,
    );
    expect(container.textContent).toContain('1 running');
    expect(jobs.watch).not.toHaveBeenCalled();
    const indicator = container.querySelector('[data-testid="process-indicator"]');
    act(() => {
      indicator?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    expect(jobs.watch).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="process-row"]')?.textContent).toContain('13%');
    act(() => {
      indicator?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    });
    expect(jobs.stop).toHaveBeenCalled();
    unmount();
  });
});
