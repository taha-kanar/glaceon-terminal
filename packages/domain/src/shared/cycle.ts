/** The item `offset` steps away from `from`, wrapping around both ends. */
export function cycle<T>(items: readonly T[], from: T, offset: number): T | undefined {
  const index = items.indexOf(from);
  if (index < 0) return undefined;
  return items[(((index + offset) % items.length) + items.length) % items.length];
}
