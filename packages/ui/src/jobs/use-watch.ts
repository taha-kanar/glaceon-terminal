import { useEffect } from 'react';

/** Keeps process polling on while the calling component is mounted (and `enabled`). */
export function useWatch(watch: () => () => void, enabled = true): void {
  useEffect(() => (enabled ? watch() : undefined), [watch, enabled]);
}
