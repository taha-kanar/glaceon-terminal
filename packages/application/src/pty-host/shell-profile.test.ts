import { describe, expect, it } from 'vitest';
import { defaultShellProfile, FALLBACK_SHELL } from './shell-profile';

describe('defaultShellProfile', () => {
  it('starts $SHELL as a login shell in the home directory', () => {
    const profile = defaultShellProfile({
      env: { SHELL: '/opt/homebrew/bin/fish' },
      shellEnv: { A: '1' },
      homeDirectory: '/Users/me',
    });

    expect(profile).toEqual({
      file: '/opt/homebrew/bin/fish',
      args: ['-l'],
      cwd: '/Users/me',
      env: { A: '1' },
    });
  });

  it('falls back to zsh when $SHELL is missing or empty', () => {
    for (const env of [{}, { SHELL: '' }]) {
      expect(defaultShellProfile({ env, shellEnv: {}, homeDirectory: '/' }).file).toBe(
        FALLBACK_SHELL,
      );
    }
  });
});
