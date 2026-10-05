import { describe, expect, it } from 'vitest';
import { render } from '../testing/render';
import { ElapsedBadge, formatElapsed } from './ElapsedBadge';

describe('elapsed time', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatElapsed(12_400)).toBe('12s');
    expect(formatElapsed(245_000)).toBe('4:05');
    expect(formatElapsed(3_723_000)).toBe('1:02:03');
    expect(formatElapsed(-5)).toBe('0s');
  });

  it('shows the time since the program started', () => {
    const { container, unmount } = render(<ElapsedBadge since={1000} now={() => 66_000} />);
    expect(container.textContent).toBe('1:05');
    unmount();
  });
});
