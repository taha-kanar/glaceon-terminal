/** invoke() channels handled by the main process. */
export const MainInvokeChannel = {
  ptyConnect: 'pty:connect',
} as const;

/** Channel on which main delivers a window's pty MessagePort to its preload. */
export const PTY_PORT_IPC_CHANNEL = 'pty:port';

/** window.postMessage type used by the preload to hand the port to the page. */
export const PTY_PORT_WINDOW_MESSAGE = 'glaceon:pty-port';
