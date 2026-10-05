import { describe, expect, it } from 'vitest';
import { buildShellEnvironment } from './shell-environment';

const options = {
  termProgram: 'Glaceon',
  termProgramVersion: '0.1.0',
  fallbackLang: 'en_US.UTF-8',
};

describe('buildShellEnvironment', () => {
  it('strips Electron and Node internals and drops undefined values', () => {
    const env = buildShellEnvironment(
      {
        PATH: '/usr/bin',
        ELECTRON_RUN_AS_NODE: '1',
        ELECTRON_RENDERER_URL: 'http://localhost',
        NODE_OPTIONS: '--inspect',
        VITE_DEV_SERVER_URL: 'x',
        EMPTY: undefined,
      },
      options,
    );

    expect(env['PATH']).toBe('/usr/bin');
    expect(Object.keys(env).some((key) => key.startsWith('ELECTRON_'))).toBe(false);
    expect(env).not.toHaveProperty('NODE_OPTIONS');
    expect(env).not.toHaveProperty('VITE_DEV_SERVER_URL');
    expect(env).not.toHaveProperty('EMPTY');
  });

  it('sets terminal identification variables', () => {
    const env = buildShellEnvironment({ TERM: 'dumb' }, options);

    expect(env).toMatchObject({
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      TERM_PROGRAM: 'Glaceon',
      TERM_PROGRAM_VERSION: '0.1.0',
    });
  });

  it('adds a fallback LANG only when missing', () => {
    expect(buildShellEnvironment({}, options)['LANG']).toBe('en_US.UTF-8');
    expect(buildShellEnvironment({ LANG: 'tr_TR.UTF-8' }, options)['LANG']).toBe('tr_TR.UTF-8');
  });
});
