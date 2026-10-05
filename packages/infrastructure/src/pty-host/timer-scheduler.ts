import type { Scheduler } from '@glaceon/application';
import { toDisposable, type Disposable } from '@glaceon/domain';

export class TimerScheduler implements Scheduler {
  setTimeout(callback: () => void, ms: number): Disposable {
    const handle = setTimeout(callback, ms);
    return toDisposable(() => {
      clearTimeout(handle);
    });
  }

  setInterval(callback: () => void, ms: number): Disposable {
    const handle = setInterval(callback, ms);
    handle.unref();
    return toDisposable(() => {
      clearInterval(handle);
    });
  }
}
