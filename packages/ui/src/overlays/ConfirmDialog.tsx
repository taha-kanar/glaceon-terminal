import type { ConfirmationRequest } from '@glaceon/application';
import { useEffect, useRef, type ReactElement } from 'react';

export interface ConfirmDialogProps {
  readonly request: ConfirmationRequest;
  readonly onAnswer: (confirmed: boolean) => void;
}

export function ConfirmDialog({ request, onAnswer }: ConfirmDialogProps): ReactElement {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
  }, [request]);

  return (
    <div className="backdrop" data-testid="confirm-dialog">
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onAnswer(false);
          }
        }}
      >
        <h2 id="confirm-title" className="dialog__title">
          {request.title}
        </h2>
        <p className="dialog__message">{request.message}</p>
        <div className="dialog__actions">
          <button
            type="button"
            className="button"
            onClick={() => {
              onAnswer(false);
            }}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="button button--danger"
            onClick={() => {
              onAnswer(true);
            }}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
