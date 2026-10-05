import { vi, type Mock } from 'vitest';
import type { AppActions } from '../app/app-model';
import type { ArrangeActions } from '../tabs/arrange-actions';

export type FakeActions = { readonly [K in keyof AppActions]: Mock<AppActions[K]> };

export function fakeActions(): FakeActions {
  return {
    runCommand: vi.fn(),
    selectTab: vi.fn(),
    closeTab: vi.fn(),
    focusPane: vi.fn(),
    setSplitRatio: vi.fn(),
    restartPane: vi.fn(),
    dismissPane: vi.fn(),
    answerConfirmation: vi.fn(),
    openSettingsFile: vi.fn(),
  };
}

export type FakeArrange = { readonly [K in keyof ArrangeActions]: Mock<ArrangeActions[K]> };

export function fakeArrange(): FakeArrange {
  return {
    beginRename: vi.fn(),
    commitRename: vi.fn(),
    cancelRename: vi.fn(),
    setColor: vi.fn(),
    togglePin: vi.fn(),
    toggleLock: vi.fn(),
    moveTab: vi.fn(),
    newGroup: vi.fn(),
    setGroup: vi.fn(),
    toggleGroupCollapsed: vi.fn(),
    setGroupColor: vi.fn(),
    ungroup: vi.fn(),
    movePane: vi.fn(),
  };
}
