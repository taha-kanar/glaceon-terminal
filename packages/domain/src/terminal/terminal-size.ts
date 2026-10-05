export interface TerminalSize {
  readonly cols: number;
  readonly rows: number;
}

export const MIN_TERMINAL_DIMENSION = 1;
export const MAX_TERMINAL_DIMENSION = 4096;

function clampDimension(value: number): number {
  if (!Number.isFinite(value)) return MIN_TERMINAL_DIMENSION;
  return Math.min(MAX_TERMINAL_DIMENSION, Math.max(MIN_TERMINAL_DIMENSION, Math.floor(value)));
}

/** A pty must never be spawned or resized with zero, negative or fractional dimensions. */
export function normalizeTerminalSize(size: TerminalSize): TerminalSize {
  return { cols: clampDimension(size.cols), rows: clampDimension(size.rows) };
}
