import { useEffect, useRef, type ReactElement } from 'react';

export interface RenameInputProps {
  readonly initial: string;
  readonly label: string;
  readonly onCommit: (name: string) => void;
  readonly onCancel: () => void;
}

/** Inline editor for tab and group names: Enter or blur saves, Escape cancels. */
export function RenameInput({
  initial,
  label,
  onCommit,
  onCancel,
}: RenameInputProps): ReactElement {
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const finish = (commit: boolean): void => {
    if (done.current) return;
    done.current = true;
    if (commit) onCommit(input.current?.value ?? '');
    else onCancel();
  };

  return (
    <input
      ref={input}
      className="rename-input"
      aria-label={label}
      defaultValue={initial}
      spellCheck={false}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') finish(true);
        else if (event.key === 'Escape') finish(false);
      }}
      onBlur={() => {
        finish(true);
      }}
    />
  );
}
