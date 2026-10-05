import { createHash } from 'node:crypto';
import { watch, type FSWatcher } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { toDisposable, type Disposable } from '@glaceon/domain';

export function contentHash(text: string): string {
  return createHash('sha1').update(text).digest('hex');
}

/**
 * Calls `onChange` when the file's content changes. The directory (not the file) is watched,
 * since editors replace files on save; events are debounced and skipped when the content still
 * hashes to `lastHash()` (e.g. after our own write).
 */
export function watchFileContent(
  path: string,
  options: {
    readonly debounceMs: number;
    readonly lastHash: () => string | undefined;
    readonly onChange: () => void;
  },
): Disposable {
  let timer: NodeJS.Timeout | undefined;
  let watcher: FSWatcher | undefined;
  const fire = (): void => {
    void readFile(path, 'utf8')
      .then(contentHash)
      .catch(() => undefined)
      .then((hash) => {
        if (hash === undefined || hash !== options.lastHash()) options.onChange();
      });
  };
  try {
    watcher = watch(dirname(path), (_event, filename) => {
      if (filename !== null && filename !== basename(path)) return;
      clearTimeout(timer);
      timer = setTimeout(fire, options.debounceMs);
    });
  } catch {
    watcher = undefined;
  }
  return toDisposable(() => {
    clearTimeout(timer);
    watcher?.close();
  });
}
