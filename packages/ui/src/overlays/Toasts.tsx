import type { Toast } from '@glaceon/application';
import type { ReactElement } from 'react';

export function Toasts({
  toasts,
  onDismiss,
}: {
  readonly toasts: readonly Toast[];
  readonly onDismiss: (id: number) => void;
}): ReactElement {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.kind === 'error' ? 'alert' : 'status'}
          className={`toast toast--${toast.kind}`}
          data-testid="toast"
          onClick={() => {
            onDismiss(toast.id);
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
