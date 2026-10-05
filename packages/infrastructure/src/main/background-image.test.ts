import { describe, expect, it, vi } from 'vitest';
import { resolveBackgroundImage } from './background-image';

vi.mock('electron', () => ({ net: {}, protocol: {} }));

describe('resolveBackgroundImage', () => {
  it('expands the home folder and keeps absolute image paths', () => {
    expect(resolveBackgroundImage('~/Pictures/wall.JPG', '/Users/me')).toBe(
      '/Users/me/Pictures/wall.JPG',
    );
    expect(resolveBackgroundImage(' /tmp/a.webp ', '/Users/me')).toBe('/tmp/a.webp');
  });

  it('refuses empty, relative and non-image paths', () => {
    expect(resolveBackgroundImage('', '/Users/me')).toBeUndefined();
    expect(resolveBackgroundImage('wall.png', '/Users/me')).toBeUndefined();
    expect(resolveBackgroundImage('/etc/passwd', '/Users/me')).toBeUndefined();
    expect(resolveBackgroundImage('~/.ssh/id_rsa', '/Users/me')).toBeUndefined();
  });
});
