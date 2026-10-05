import { describe, expect, it } from 'vitest';
import { findLinks, resolveLinkPath } from './links';

const texts = (line: string) => findLinks(line).map((l) => line.slice(l.start, l.end));

describe('findLinks', () => {
  it('finds URLs and trims trailing punctuation and unbalanced parentheses', () => {
    expect(texts('see https://example.com/a?b=1.')).toEqual(['https://example.com/a?b=1']);
    expect(texts('(docs: https://x.dev/a_(b))')).toEqual(['https://x.dev/a_(b)']);
    expect(findLinks('mail mailto:me@x.dev now')[0]).toMatchObject({
      kind: 'url',
      url: 'mailto:me@x.dev',
    });
  });

  it('does not report paths inside URLs (legacy overlap bug)', () => {
    const links = findLinks('open https://github.com/a/b/blob/main/src/x.ts:10 please');
    expect(links).toHaveLength(1);
    expect(links[0]?.kind).toBe('url');
  });

  it('parses file:line:col in common forms', () => {
    expect(findLinks('/Users/me/app/src/index.ts:12:5')[0]).toMatchObject({
      kind: 'file',
      path: '/Users/me/app/src/index.ts',
      line: 12,
      column: 5,
    });
    expect(findLinks('error in ./lib/a.js:3')[0]).toMatchObject({ path: './lib/a.js', line: 3 });
    expect(findLinks('~/notes/todo.md')[0]).toMatchObject({ path: '~/notes/todo.md' });
    expect(findLinks('src/main.rs:40:9: warning')[0]).toMatchObject({
      path: 'src/main.rs',
      line: 40,
      column: 9,
    });
    expect(findLinks('main.go:7:2: undefined: x')[0]).toMatchObject({
      path: 'main.go',
      line: 7,
      column: 2,
    });
    expect(findLinks('see src/app.ts.')[0]).toMatchObject({ path: 'src/app.ts' });
  });

  it('understands stack traces from node, python and tsc', () => {
    expect(findLinks('    at run (/srv/app/server.js:88:13)')[0]).toMatchObject({
      path: '/srv/app/server.js',
      line: 88,
      column: 13,
    });
    expect(findLinks('    at file:///srv/app/my%20mod.mjs:4:1')[0]).toMatchObject({
      path: '/srv/app/my mod.mjs',
      line: 4,
      column: 1,
    });
    expect(findLinks('  File "/usr/lib/python3/x.py", line 12, in <module>')[0]).toMatchObject({
      path: '/usr/lib/python3/x.py',
      line: 12,
    });
    expect(findLinks('src/a.ts(3,14): error TS2322')[0]).toMatchObject({
      path: 'src/a.ts',
      line: 3,
      column: 14,
    });
  });

  it('ignores version numbers, bare words and lone slashes', () => {
    expect(findLinks('node v24.1.0 and 1.2.3 and foo.bar and / and ./')).toEqual([]);
  });

  it('reports several links left to right without overlaps', () => {
    const line = 'a.ts:1 b/c.ts https://x.io ./d.ts:2:3';
    expect(texts(line)).toEqual(['a.ts:1', 'b/c.ts', 'https://x.io', './d.ts:2:3']);
  });

  it('uses UTF-16 offsets that survive wide characters before the link', () => {
    const line = '日本語 ./src/x.ts:9';
    const [link] = findLinks(line);
    expect(link && line.slice(link.start, link.end)).toBe('./src/x.ts:9');
  });
});

describe('resolveLinkPath', () => {
  const base = { cwd: '/work/app', home: '/Users/me' };
  it('resolves home, relative and absolute paths', () => {
    expect(resolveLinkPath('~/x.md', base)).toBe('/Users/me/x.md');
    expect(resolveLinkPath('./src/../lib/a.ts', base)).toBe('/work/app/lib/a.ts');
    expect(resolveLinkPath('src/a.ts', { cwd: undefined, home: '/h' })).toBe('/h/src/a.ts');
    expect(resolveLinkPath('/etc//hosts', base)).toBe('/etc/hosts');
  });
});
