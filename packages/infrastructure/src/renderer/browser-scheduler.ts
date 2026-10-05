import type { Scheduler } from '@glaceon/application';
import { toDisposable, type Disposable } from '@glaceon/domain';

export class BrowserScheduler implements Scheduler {
  setTimeout(callback: () => void, ms: number): Disposable {
    const handle = window.setTimeout(callback, ms);
    return toDisposable(() => {
      window.clearTimeout(handle);
    });
  }

  setInterval(callback: () => void, ms: number): Disposable {
    const handle = window.setInterval(callback, ms);
    return toDisposable(() => {
      window.clearInterval(handle);
    });
  }
}
