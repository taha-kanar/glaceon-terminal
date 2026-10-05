import { expect, test } from './fixtures/app';

test('starts a shell and round-trips a command', async ({ window }) => {
  await expect.poll(() => window.sessionPid()).toBeGreaterThan(0);

  await window.type('echo $((40 + 2))\n');

  await expect.poll(() => window.terminalText()).toMatch(/^42$/m);
});

test('renderer is sandboxed and isolated', async ({ window }) => {
  const exposed = await window.page.evaluate(() => ({
    require: typeof (globalThis as { require?: unknown }).require,
    process: typeof (globalThis as { process?: unknown }).process,
    bridgeKeys: Object.keys((window as unknown as { glaceon: object }).glaceon).sort(),
  }));

  expect(exposed).toEqual({
    require: 'undefined',
    process: 'undefined',
    bridgeKeys: [
      'chooseBackgroundImage',
      'closeWindow',
      'connectPty',
      'e2e',
      'getClipboardRing',
      'getSettings',
      'getSnippets',
      'newWindow',
      'onClipboardRingChanged',
      'onCloseRequested',
      'onImportTab',
      'onRunCommand',
      'onSettingsChanged',
      'onSnippetsChanged',
      'onWindowsChanged',
      'openLink',
      'openSettingsFile',
      'openSnippetsFile',
      'transferTab',
      'updateSetting',
      'windowKind',
      'windowReady',
      'writeClipboard',
    ],
  });
});
