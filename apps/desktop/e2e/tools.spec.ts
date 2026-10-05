import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from './fixtures/app';

const SNIPPETS = `// test snippets
[
  { "name": "Greet someone", "body": "echo hello-{{who:world}}-{{count}}" },
  { "name": "Plain marker", "body": "echo plain-marker" }
]
`;

test('snippets fill every placeholder in one form and paste into the pane', async ({
  window,
  configDir,
}) => {
  await writeFile(join(configDir, 'snippets.json'), SNIPPETS);
  const picker = window.page.getByTestId('snippet-picker');
  // The open picker follows snippets.json as it is reloaded.
  await window.press('Meta+Shift+s');
  await expect(picker.getByTestId('snippet').first()).toContainText('Greet someone');

  await window.type('greet');
  await window.press('Enter');
  const form = window.page.getByTestId('snippet-form');
  await expect(form.locator('[name="who"]')).toHaveValue('world');
  await form.locator('[name="count"]').fill('3');
  await expect(form.getByTestId('snippet-preview')).toHaveText('echo hello-world-3');
  await form.locator('[name="count"]').press('Enter');
  await expect(picker).toHaveCount(0);
  await window.press('Enter');
  await expect.poll(() => window.terminalText()).toMatch(/^hello-world-3$/m);

  // From the command palette: a snippet without placeholders pastes directly.
  await window.press('Meta+Shift+p');
  await window.type('plain marker');
  await window.press('Enter');
  await window.press('Enter');
  await expect.poll(() => window.terminalText()).toMatch(/^plain-marker$/m);
});

test.describe('clipboard ring', () => {
  test.use({ initialSettings: '{ "copyOnSelect": true }' });

  test('copy-on-select feeds the ring; ⌘⇧V and a digit paste it back', async ({ window }) => {
    await window.type('echo first-clip; echo second-clip\n');
    await expect.poll(() => window.terminalText()).toMatch(/^second-clip$/m);

    for (const word of ['first-clip', 'second-clip']) {
      const point = await window.page.evaluate(
        (t) => globalThis.window.__glaceonE2E.locateText(t),
        word,
      );
      if (point === undefined) throw new Error(`${word} is not on screen`);
      // A double-click selects the word under the pointer (xterm splits on '-' too, so
      // aim at the start and compare the selected prefix).
      await window.page.mouse.dblclick(point.x - 4, point.y);
    }
    const picker = window.page.getByTestId('clipboard-picker');
    await window.press('Meta+Shift+v');
    await expect(picker.getByTestId('clip')).toHaveCount(2);
    const items = await picker.getByTestId('clip').allTextContents();
    expect(items[0]).toContain('second');
    expect(items[1]).toContain('first');
    await window.press('Escape');
    await expect(picker).toHaveCount(0);

    await window.page.keyboard.type('echo pasted-');
    await window.press('Meta+Shift+v');
    await window.press('2');
    await expect(picker).toHaveCount(0);
    await window.press('Enter');
    await expect.poll(() => window.terminalText()).toMatch(/^pasted-first/m);
  });
});
