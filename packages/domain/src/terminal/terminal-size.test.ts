import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  MAX_TERMINAL_DIMENSION,
  MIN_TERMINAL_DIMENSION,
  normalizeTerminalSize,
} from './terminal-size';

describe('normalizeTerminalSize', () => {
  it('keeps valid sizes unchanged', () => {
    expect(normalizeTerminalSize({ cols: 120, rows: 40 })).toEqual({ cols: 120, rows: 40 });
  });

  it('floors fractional and replaces non-finite dimensions', () => {
    expect(normalizeTerminalSize({ cols: 80.9, rows: Number.NaN })).toEqual({ cols: 80, rows: 1 });
  });

  it('always produces integer dimensions within bounds', () => {
    fc.assert(
      fc.property(fc.double(), fc.double(), (cols, rows) => {
        const size = normalizeTerminalSize({ cols, rows });
        for (const value of [size.cols, size.rows]) {
          expect(Number.isInteger(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(MIN_TERMINAL_DIMENSION);
          expect(value).toBeLessThanOrEqual(MAX_TERMINAL_DIMENSION);
        }
      }),
    );
  });
});
