import { vi, type Mock } from 'vitest';
import type { AppActions } from '../app/app-model';

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
