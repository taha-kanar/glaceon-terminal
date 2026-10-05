import { TerminalSessionService, type TerminalSession } from '@glaceon/application';
import {
  MessagePortPtyClient,
  RandomIdGenerator,
  requestPtyPort,
  XtermTerminalView,
} from '@glaceon/infrastructure/renderer';
import { App, type TerminalMount } from '@glaceon/ui';
import { createElement, type ReactElement } from 'react';
import type { E2EProbe } from './global';

export interface RendererCompositionRoot {
  render(): ReactElement;
}

const viewOptions = {
  fontFamily: 'Menlo, monospace',
  fontSize: 13,
  theme: { background: '#00000000', foreground: '#c0caf5', cursor: '#c0caf5' },
};

/** Wires one renderer window: pty client, session service, xterm views and the React tree. */
export async function createRendererCompositionRoot(
  target: Window,
): Promise<RendererCompositionRoot> {
  const pty = new MessagePortPtyClient(await requestPtyPort(target.glaceon, target));
  const sessions = new TerminalSessionService({ pty, ids: new RandomIdGenerator() });

  let activeView: XtermTerminalView | undefined;
  let activeSession: TerminalSession | undefined;

  const mountTerminal: TerminalMount = (element) => {
    const view = new XtermTerminalView(element, viewOptions);
    activeView = view;
    let disposed = false;
    void sessions.open(view).then((result) => {
      if (!result.ok) {
        view.write(
          new TextEncoder().encode(`\r\nFailed to start shell: ${result.error.message}\r\n`),
        );
        return;
      }
      if (disposed) {
        result.value.close();
        return;
      }
      activeSession = result.value;
      view.focus();
    });
    return () => {
      disposed = true;
      activeSession?.close();
      view.dispose();
    };
  };

  if (target.glaceon.e2e) {
    const probe: E2EProbe = {
      terminalText: () => activeView?.readText() ?? '',
      sessionPid: () => activeSession?.pid,
    };
    target.__glaceonE2E = probe;
  }

  return {
    render: () => createElement(App, { mountTerminal }),
  };
}
