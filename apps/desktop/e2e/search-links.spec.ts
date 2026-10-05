import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from './fixtures/app';

test('find highlights matches, counts them and steps through them', async ({ window }) => {
  await window.type('printf "needle one\\nhay\\nneedle two\\nNEEDLE three\\n"\n');
  await expect.poll(() => window.terminalText()).toMatch(/^NEEDLE three$/m);

  await window.press('Meta+f');
  const bar = window.page.getByTestId('search-bar');
  await expect(bar).toBeVisible();
  await window.type('needle');
  const count = window.page.getByTestId('search-count');
  // The echoed command line contains the three words too.
  await expect(count).toHaveText(/of 6$/);
  await bar.getByTitle('Match case').click();
  await expect(count).toHaveText(/of 4$/);
  const first = await count.textContent();
  await window.press('Meta+g');
  await expect(count).not.toHaveText(first ?? '');

  await window.press('Escape');
  await expect(bar).toHaveCount(0);
  await window.type('echo back-in-terminal\n');
  await expect.poll(() => window.terminalText()).toMatch(/^back-in-terminal$/m);
});

test.describe('clickable links', () => {
  let dir: string;
  let log: string;

  test.beforeAll(async () => {
    // The shell reports its cwd with /var resolved to /private/var.
    dir = await realpath(await mkdtemp(join(tmpdir(), 'glaceon-links-e2e-')));
    log = join(dir, 'editor.log');
    const editor = join(dir, 'editor.sh');
    await writeFile(editor, `#!/bin/sh\nprintf '%s\\n' "$@" >> "${log}"\n`);
    await chmod(editor, 0o755);
    await mkdir(join(dir, 'src'));
    for (const file of ['a.ts', 'b.ts', 'c.py', 'd.js', 'e.ts'])
      await writeFile(join(dir, 'src', file), '');
    await writeFile(
      join(dir, 'config.json'),
      JSON.stringify({ editorCommand: `${editor} {file}:{line}:{col}` }),
    );
  });

  test.afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test.use({ initialSettings: undefined });

  test('⌘-click opens every trace format in the editor at the right position', async ({
    window,
    configDir,
  }) => {
    await writeFile(join(configDir, 'config.json'), await readFile(join(dir, 'config.json')));
    await expect.poll(async () => (await window.problems()).length).toBe(0);
    await window.type(`cd ${dir}\n`);
    await window.type(
      [
        'printf "%s\\n"',
        `"    at run (${dir}/src/a.ts:12:5)"`,
        '"src/b.ts(3,14): error TS2322"',
        `"  File \\"${dir}/src/c.py\\", line 9, in <module>"`,
        '"日本語 ./src/d.js:7"',
        '"see src/e.ts."',
      ].join(' ') + '\n',
    );
    await expect.poll(() => window.terminalText()).toMatch(/^see src\/e\.ts\.$/m);

    const expected: [string, string][] = [
      [`${dir}/src/a.ts:12:5`, `${dir}/src/a.ts:12:5`],
      ['src/b.ts(3,14)', `${dir}/src/b.ts:3:14`],
      [`${dir}/src/c.py`, `${dir}/src/c.py:9:1`],
      ['./src/d.js:7', `${dir}/src/d.js:7:1`],
      ['src/e.ts', `${dir}/src/e.ts:1:1`],
    ];
    for (const [text, argument] of expected) {
      await window.commandClick(text);
      await expect
        .poll(async () => (await readFile(log, 'utf8').catch(() => '')).trim().split('\n').at(-1))
        .toBe(argument);
    }
  });

  test('a missing editor shows a toast', async ({ window, configDir }) => {
    await writeFile(
      join(configDir, 'config.json'),
      '{ "editorCommand": "no-such-editor-xyz {file}" }',
    );
    await expect.poll(async () => (await window.problems()).length).toBe(0);
    await window.page.waitForTimeout(300);
    await window.type(`printf "${dir}/src/a.ts:1\\n"\n`);
    await expect.poll(() => window.terminalText()).toMatch(/^\/.*src\/a\.ts:1$/m);
    await window.commandClick(`${dir}/src/a.ts:1`);
    await expect(window.page.getByTestId('toast')).toContainText('no-such-editor-xyz');
  });
});
