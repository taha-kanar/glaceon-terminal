import type { ReadableStore } from '@glaceon/application';
import { useCallback, useSyncExternalStore } from 'react';

/** Subscribes a component to an application store. */
export function useStore<T>(store: ReadableStore<T>): T {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = store.subscribe(onChange);
      return () => {
        subscription.dispose();
      };
    },
    [store],
  );
  return useSyncExternalStore(subscribe, () => store.get());
}
