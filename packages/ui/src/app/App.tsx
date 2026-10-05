import type { ReactElement } from 'react';
import { TerminalSlot, type TerminalMount } from '../terminal/TerminalSlot';

export interface AppProps {
  readonly mountTerminal: TerminalMount;
}

export function App({ mountTerminal }: AppProps): ReactElement {
  return (
    <div className="app">
      <header className="titlebar" />
      <main className="workspace">
        <TerminalSlot mount={mountTerminal} />
      </main>
    </div>
  );
}
