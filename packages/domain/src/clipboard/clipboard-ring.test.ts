import { describe, expect, it } from 'vitest';
import { clipPreview, pushClip } from './clipboard-ring';

describe('clipboard ring', () => {
  it('keeps the newest ten unique clips', () => {
    let ring: readonly string[] = [];
    for (let i = 0; i < 12; i++) ring = pushClip(ring, `clip ${String(i)}`);
    expect(ring).toHaveLength(10);
    expect(ring[0]).toBe('clip 11');
    ring = pushClip(ring, 'clip 5');
    expect(ring.slice(0, 2)).toEqual(['clip 5', 'clip 11']);
    expect(ring.filter((c) => c === 'clip 5')).toHaveLength(1);
    expect(pushClip(ring, '  \n')).toBe(ring);
    expect(pushClip(ring, 'clip 5')).toBe(ring);
  });

  it('previews clips on one line', () => {
    expect(clipPreview('a\n  b\tc')).toBe('a b c');
    expect(clipPreview('x'.repeat(100), 10)).toBe(`${'x'.repeat(9)}…`);
  });
});
