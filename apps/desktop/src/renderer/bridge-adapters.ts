import type { SettingsWriter, WindowPort } from '@glaceon/application';
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
