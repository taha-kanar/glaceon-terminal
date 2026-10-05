import { describe, expect, it } from 'vitest';
import { renderSnippet, snippetVariables } from './snippet';

describe('snippets', () => {
  const body = 'ssh {{user:root}}@{{host}} -p {{ port : 22 }} # {{host}} {{user}}';

  it('lists variables once, in order, with defaults', () => {
    expect(snippetVariables(body)).toEqual([
      { name: 'user', defaultValue: 'root' },
      { name: 'host', defaultValue: '' },
      { name: 'port', defaultValue: ' 22 ' },
    ]);
    expect(snippetVariables('{{a}} {{a:later}}')).toEqual([{ name: 'a', defaultValue: 'later' }]);
    expect(snippetVariables('no placeholders {{ }} {x}')).toEqual([]);
  });

  it('fills placeholders, falling back to defaults', () => {
    expect(renderSnippet(body, { host: 'db.local', port: '2200' })).toBe(
      'ssh root@db.local -p 2200 # db.local root',
    );
    expect(renderSnippet('git commit -m "{{message}}"', {})).toBe('git commit -m ""');
    expect(renderSnippet('{{a:x}}', { a: '' })).toBe('x');
  });
});
