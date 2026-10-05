import { describe, expect, it } from 'vitest';
import { cycle } from './cycle';

describe('cycle', () => {
  it('wraps around both ends', () => {
    expect(cycle([1, 2, 3], 3, 1)).toBe(1);
    expect(cycle([1, 2, 3], 1, -1)).toBe(3);
    expect(cycle([1, 2, 3], 2, -7)).toBe(1);
    expect(cycle([1, 2, 3], 9, 1)).toBeUndefined();
  });
});
