import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorLauncher } from './editor-launcher';
import { SystemLinkOpener } from './system-link-opener';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'glaceon-links-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function fakeEditor(): Promise<{ script: string; log: string }> {
  const script = join(dir, 'fake editor.sh');
  const log = join(dir, 'editor.log');
  await writeFile(script, `#!/bin/sh\nprintf '%s\\n' "$@" > "${log}"\n`);
  await chmod(script, 0o755);
  return { script, log };
}

function opener(editorCommand: string) {
  const openExternal = vi.fn(() => Promise.resolve());
  const openPath = vi.fn(() => Promise.resolve(''));
  const links = new SystemLinkOpener({
    home: dir,
    editorCommand: () => editorCommand,
    editor: new EditorLauncher({ shell: '/bin/sh', settleMs: 3000 }),
    openExternal,
    openPath,
  });
  return { links, openExternal, openPath };
}

describe('SystemLinkOpener', () => {
  it('opens only web and mail links externally', async () => {
    const { links, openExternal } = opener('code');
    expect((await links.openUrl('https://example.com')).ok).toBe(true);
    expect(await links.openUrl('javascript:alert(1)')).toMatchObject({ ok: false });
    expect(await links.openUrl('not a url')).toMatchObject({ ok: false });
    expect(openExternal).toHaveBeenCalledOnce();
  });

  it('runs the editor with file:line:col as a single argument, resolving relative paths', async () => {
    const { script, log } = await fakeEditor();
    await mkdir(join(dir, 'src'));
    await writeFile(join(dir, 'src', 'a b.ts'), '');
    const { links } = opener(`'${script}' -g {file}:{line}:{col}`);
    const result = await links.openFile({ path: './src/a b.ts', cwd: dir, line: 7, column: 3 });
    expect(result).toEqual({ ok: true, value: undefined });
    expect((await readFile(log, 'utf8')).split('\n')).toEqual(['-g', `${dir}/src/a b.ts:7:3`, '']);
  });

  it('opens directories with the default app and reports missing files and editors', async () => {
    const { links, openPath } = opener('definitely-not-an-editor-xyz {file}');
    expect((await links.openFile({ path: '~' })).ok).toBe(true);
    expect(openPath).toHaveBeenCalledWith(dir);
    expect(await links.openFile({ path: '/nope/missing.ts' })).toMatchObject({ ok: false });
    await writeFile(join(dir, 'x.ts'), '');
    expect(await links.openFile({ path: '~/x.ts' })).toEqual({
      ok: false,
      error: 'Editor "definitely-not-an-editor-xyz" was not found',
    });
  });
});
