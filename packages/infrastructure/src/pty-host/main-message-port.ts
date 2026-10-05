/** The subset of Electron's MessagePortMain the pty host relies on. */
export interface MainMessagePort {
  postMessage(message: unknown): void;
  start(): void;
  close(): void;
  on(event: 'message', listener: (event: { data: unknown }) => void): this;
  on(event: 'close', listener: () => void): this;
}
