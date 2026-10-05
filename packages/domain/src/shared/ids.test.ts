import { describe, expect, it } from 'vitest';
import { asSessionId } from './ids';

describe('asSessionId', () => {
  it('accepts non-empty strings', () => {
    expect(asSessionId('abc')).toBe('abc');
  });

  it('rejects empty strings', () => {
    expect(() => asSessionId('')).toThrow(RangeError);
  });
});
