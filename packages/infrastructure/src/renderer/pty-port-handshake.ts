import { PTY_PORT_WINDOW_MESSAGE, type GlaceonBridge } from '@glaceon/contracts';

/**
 * Asks main for a pty-host connection and resolves with the MessagePort the preload
 * forwards to this page (ports cannot cross the context bridge directly).
 */
export function requestPtyPort(bridge: GlaceonBridge, target: Window): Promise<MessagePort> {
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<unknown>): void => {
      const data = event.data;
      const isPortMessage =
        event.source === target &&
        typeof data === 'object' &&
        data !== null &&
        (data as { type?: unknown }).type === PTY_PORT_WINDOW_MESSAGE;
      const port = event.ports[0];
      if (!isPortMessage || port === undefined) return;
      target.removeEventListener('message', onMessage);
      resolve(port);
    };
    target.addEventListener('message', onMessage);
    bridge.connectPty().catch((error: unknown) => {
      target.removeEventListener('message', onMessage);
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}
