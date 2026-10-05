import { describe, expect, it } from 'vitest';
import { renderEditorArgv, splitCommand } from './editor-command';

describe('editor commands', () => {
  it('splits with quotes', () => {
    expect(splitCommand(`code -g "a b" 'c d' ""`)).toEqual(['code', '-g', 'a b', 'c d', '']);
  });

  it('substitutes placeholders inside words without a shell', () => {
    const target = { file: '/tmp/my file; rm -rf ~.ts', line: 3, column: 7 };
    expect(renderEditorArgv('code -g {file}:{line}:{col}', target)).toEqual([
      'code',
      '-g',
      '/tmp/my file; rm -rf ~.ts:3:7',
    ]);
    expect(renderEditorArgv('subl', target)).toEqual(['subl', target.file]);
    expect(renderEditorArgv('vim +{line} {file}', target)).toEqual(['vim', '+3', target.file]);
  });
});
