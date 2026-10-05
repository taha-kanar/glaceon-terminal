import { CommandIds } from '@glaceon/domain';
import { describe, expect, it, vi } from 'vitest';
import { click, render } from '../testing/render';
import { TitleBar } from './TitleBar';

describe('TitleBar', () => {
  it('runs commands from its buttons and shows their shortcuts', () => {
    const runCommand = vi.fn();
    const labels: Record<string, string> = {
      [CommandIds.paletteToggle]: '⇧⌘P',
      [CommandIds.settingsOpen]: '⌘,',
    };
    const { container, unmount } = render(
      <TitleBar labelFor={(command) => labels[command]} runCommand={runCommand} />,
    );
    const bar = container.querySelector('[data-testid="command-bar"]');
    expect(bar?.textContent).toContain('⇧⌘P');
    click(bar);
    expect(runCommand).toHaveBeenLastCalledWith(CommandIds.paletteToggle);

    const settings = container.querySelector('[data-testid="settings-button"]');
    expect(settings?.getAttribute('title')).toBe('Settings (⌘,)');
    click(settings);
    expect(runCommand).toHaveBeenLastCalledWith(CommandIds.settingsOpen);

    click(container.querySelector('[aria-label="Split Right"]'));
    expect(runCommand).toHaveBeenLastCalledWith(CommandIds.paneSplitRight);
    unmount();
  });
});
