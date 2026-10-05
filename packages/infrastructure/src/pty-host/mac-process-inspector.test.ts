import { describe, expect, it } from 'vitest';
import { MacProcessInspector, parseLsofCwd, parsePsCommand } from './mac-process-inspector';

describe('parsers', () => {
  it('reads the lsof name field', () => {
    expect(parseLsofCwd('p123\nfcwd\nn/Users/me/My Projects\n')).toBe('/Users/me/My Projects');
    expect(parseLsofCwd('p123\n')).toBeUndefined();
  });

  it('reduces ps command names to the executable name', () => {
    expect(parsePsCommand('/bin/zsh\n')).toBe('zsh');
    expect(parsePsCommand('-zsh\n')).toBe('zsh');
    expect(parsePsCommand('  \n')).toBeUndefined();
  });
});

describe('MacProcessInspector', () => {
  const inspector = new MacProcessInspector();

  it('finds the cwd and name of a live process', async () => {
    expect(await inspector.cwdOf(process.pid)).toBe(process.cwd());
    expect(await inspector.nameOf(process.pid)).toMatch(/node/);
  });

  it('yields undefined for processes that do not exist', async () => {
    expect(await inspector.cwdOf(999_999)).toBeUndefined();
    expect(await inspector.nameOf(999_999)).toBeUndefined();
  });
});
