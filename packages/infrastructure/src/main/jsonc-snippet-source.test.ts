import { describe, expect, it } from 'vitest';
import { parseSnippetsText, SNIPPETS_TEMPLATE } from './jsonc-snippet-source';

describe('parseSnippetsText', () => {
  it('reads the template and reports broken files', () => {
    const template = parseSnippetsText(SNIPPETS_TEMPLATE);
    expect(template.ok && template.value.map((s) => s.name)).toEqual([
      'Find files by name',
      'Git commit',
    ]);
    expect(parseSnippetsText('// nothing yet\n')).toEqual({ ok: true, value: [] });
    const broken = parseSnippetsText('[ { "name": "x", ');
    expect(broken.ok ? '' : broken.error).toContain('line 1');
    const invalid = parseSnippetsText('[ { "name": "", "body": "x" } ]');
    expect(invalid.ok ? '' : invalid.error).toContain('0.name');
  });
});
