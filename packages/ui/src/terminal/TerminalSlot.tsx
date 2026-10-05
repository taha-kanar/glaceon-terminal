import { useEffect, useRef, type ReactElement } from 'react';

/** Attaches a terminal to an element and returns its teardown. Provided by the composition root. */
export type TerminalMount = (element: HTMLElement) => () => void;

export interface TerminalSlotProps {
  readonly mount: TerminalMount;
}

/** A DOM slot the terminal renderer draws into. React never touches the terminal's own DOM. */
export function TerminalSlot({ mount }: TerminalSlotProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (element === null) return undefined;
    return mount(element);
  }, [mount]);

  return <div ref={ref} className="terminal-slot" data-testid="terminal-slot" />;
}
