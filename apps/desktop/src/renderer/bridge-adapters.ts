import type { LinkOpener, SettingsWriter, WindowPort } from '@glaceon/application';
import type { GlaceonBridge } from '@glaceon/contracts';
import { err, ok } from '@glaceon/domain';

/** Application ports implemented on top of the preload bridge. */
export function windowPortFor(bridge: GlaceonBridge): WindowPort {
  return {
    newWindow: () => bridge.newWindow(),
    close: () => bridge.closeWindow(),
    openSettingsFile: () => bridge.openSettingsFile(),
  };
}

export function settingsWriterFor(bridge: GlaceonBridge): SettingsWriter {
  return {
    update: async (key, value) => {
      const result = await bridge.updateSetting({ key, value });
      return result.ok ? ok(undefined) : err(result.error);
    },
  };
}

export function linkOpenerFor(bridge: GlaceonBridge): LinkOpener {
  const call = async (request: Parameters<GlaceonBridge['openLink']>[0]) => {
    const result = await bridge.openLink(request);
    return result.ok ? ok(undefined) : err(result.error);
  };
  return {
    openUrl: (url) => call({ kind: 'url', url }),
    openFile: (request) => call({ kind: 'file', ...request }),
  };
}
