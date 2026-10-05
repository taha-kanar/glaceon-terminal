import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BUILTIN_THEMES, cloneTheme } from '@glaceon/domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JsoncSettingsSource, parseSettingsText } from './jsonc-settings-source';

let dir: string;
let path: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'glaceon-settings-'));
  path = join(dir, 'config.json');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('parseSettingsText', () => {
  it('accepts comments and trailing commas', () => {
    expect(parseSettingsText('// hi\n{ "fontSize": 14, }')).toEqual({
      ok: true,
      value: { fontSize: 14 },
    });
    expect(parseSettingsText('')).toEqual({ ok: true, value: {} });
  });

  it('reports syntax errors with a line and schema errors with a path', () => {
    const syntax = parseSettingsText('{\n  "fontSize": 14,\n  oops\n}');
    expect(!syntax.ok && syntax.error).toMatch(/line 3/);
    const schema = parseSettingsText('{ "keybindings": [{ "key": "x" }] }');
    expect(!schema.ok && schema.error).toMatch(/keybindings\.0\.command/);
  });
});

describe('JsoncSettingsSource', () => {
  it('creates the template once and reads a missing file as empty', async () => {
    const source = new JsoncSettingsSource({ path });
    expect(await source.read()).toEqual({ ok: true, value: {} });
    await source.ensureExists();
    await writeFile(path, '{ "fontSize": 20 }');
    await source.ensureExists();
    expect(await source.read()).toEqual({ ok: true, value: { fontSize: 20 } });
  });

  it('writes values in place, keeping comments', async () => {
    const source = new JsoncSettingsSource({ path });
    await writeFile(path, '// keep me\n{\n  // and me\n  "fontSize": 13\n}\n');
    expect((await source.write('fontSize', 16)).ok).toBe(true);
    expect((await source.write('theme', 'nord')).ok).toBe(true);
    const theme = cloneTheme(BUILTIN_THEMES[0]!, { id: 'mine', name: 'Mine' });
    expect((await source.write('customThemes', [theme])).ok).toBe(true);
    const text = await readFile(path, 'utf8');
    expect(text).toContain('// keep me');
    expect(text).toContain('// and me');
    expect(await source.read()).toEqual({
      ok: true,
      value: { fontSize: 16, theme: 'nord', customThemes: [theme] },
    });
  });

  it('refuses invalid values and files with syntax errors', async () => {
    const source = new JsoncSettingsSource({ path });
    expect(await source.write('fontSize', 500)).toMatchObject({ ok: false });
    expect(await source.write('nope' as 'fontSize', 1)).toEqual({
      ok: false,
      error: 'Unknown setting "nope"',
    });
    await writeFile(path, '{ "fontSize": ');
    expect(await source.write('fontSize', 12)).toMatchObject({ ok: false });
  });

  it('writes into the template when the file does not exist', async () => {
    const source = new JsoncSettingsSource({ path });
    expect((await source.write('cursorBlink', false)).ok).toBe(true);
    expect(await source.read()).toEqual({
      ok: true,
      value: { cursorBlink: false, keybindings: [] },
    });
  });

  it('notifies about external changes but not about identical content', async () => {
    const source = new JsoncSettingsSource({ path, debounceMs: 20 });
    await writeFile(path, '{}');
    await source.read();
    let changes = 0;
    const watching = source.watch(() => changes++);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await writeFile(path, '{}');
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(changes).toBe(0);
    await writeFile(path, '{ "fontSize": 15 }');
    await expect.poll(() => changes).toBeGreaterThan(0);
    watching.dispose();
  });
});
