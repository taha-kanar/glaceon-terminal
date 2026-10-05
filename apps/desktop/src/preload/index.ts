import {
  BRIDGE_KEY,
  E2E_SWITCH,
  MainInvokeChannel,
  PTY_PORT_IPC_CHANNEL,
  PTY_PORT_WINDOW_MESSAGE,
  type GlaceonBridge,
} from '@glaceon/contracts';
import { contextBridge, ipcRenderer } from 'electron';

// MessagePorts cannot cross the context bridge, so the port is re-posted to the page.
ipcRenderer.on(PTY_PORT_IPC_CHANNEL, (event) => {
  window.postMessage({ type: PTY_PORT_WINDOW_MESSAGE }, '*', event.ports);
});

const bridge: GlaceonBridge = {
  e2e: process.argv.includes(E2E_SWITCH),
  connectPty: async () => {
    await ipcRenderer.invoke(MainInvokeChannel.ptyConnect);
  },
};

contextBridge.exposeInMainWorld(BRIDGE_KEY, bridge);
