import {
  BRIDGE_KEY,
  decodeRunCommandRequest,
  E2E_SWITCH,
  MainInvokeChannel,
  MainSendChannel,
  PTY_PORT_IPC_CHANNEL,
  PTY_PORT_WINDOW_MESSAGE,
  RendererChannel,
  type GlaceonBridge,
  type SettingsSnapshot,
  type SettingsUpdateResult,
  type Unsubscribe,
} from '@glaceon/contracts';
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

// MessagePorts cannot cross the context bridge, so the port is re-posted to the page.
ipcRenderer.on(PTY_PORT_IPC_CHANNEL, (event) => {
  window.postMessage({ type: PTY_PORT_WINDOW_MESSAGE }, '*', event.ports);
});

/** Subscribes to a main → renderer channel without exposing the IPC event object. */
function listen(channel: string, listener: (payload: unknown) => void): Unsubscribe {
  const handler = (_event: IpcRendererEvent, payload: unknown): void => {
    listener(payload);
  };
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const bridge: GlaceonBridge = {
  e2e: process.argv.includes(E2E_SWITCH),
  connectPty: async () => {
    await ipcRenderer.invoke(MainInvokeChannel.ptyConnect);
  },
  getSettings: () => ipcRenderer.invoke(MainInvokeChannel.settingsGet) as Promise<SettingsSnapshot>,
  updateSetting: (request) =>
    ipcRenderer.invoke(MainInvokeChannel.settingsUpdate, request) as Promise<SettingsUpdateResult>,
  // Payloads from main are trusted; run-command requests are still decoded defensively.
  onSettingsChanged: (listener) =>
    listen(RendererChannel.settingsChanged, (payload) => listener(payload as SettingsSnapshot)),
  onRunCommand: (listener) =>
    listen(RendererChannel.runCommand, (payload) => {
      const request = decodeRunCommandRequest(payload);
      if (request !== undefined) listener(request);
    }),
  onCloseRequested: (listener) => listen(RendererChannel.closeRequested, () => listener()),
  newWindow: () => {
    ipcRenderer.send(MainSendChannel.windowNew);
  },
  closeWindow: () => {
    ipcRenderer.send(MainSendChannel.windowClose);
  },
  openSettingsFile: () => {
    ipcRenderer.send(MainSendChannel.settingsOpenFile);
  },
};

contextBridge.exposeInMainWorld(BRIDGE_KEY, bridge);
