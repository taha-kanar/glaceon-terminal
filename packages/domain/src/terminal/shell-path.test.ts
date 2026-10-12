import { describe, expect, it } from 'vitest';
import { droppedPathsText, quoteShellPath } from './shell-path';

describe('quoteShellPath', () => {
  it('leaves plain paths alone, unicode included', () => {
    expect(quoteShellPath('/Users/taha/Belgeler/özet.pdf')).toBe('/Users/taha/Belgeler/özet.pdf');
  });

  it('escapes spaces, quotes and shell syntax with backslashes', () => {
    expect(quoteShellPath('/tmp/My File.txt')).toBe('/tmp/My\\ File.txt');
    expect(quoteShellPath(`/tmp/it's "x"`)).toBe(`/tmp/it\\'s\\ \\"x\\"`);
    expect(quoteShellPath('/tmp/$HOME&(a);*')).toBe('/tmp/\\$HOME\\&\\(a\\)\\;\\*');
  });

  it('uses ANSI-C quoting for names with control characters', () => {
    expect(quoteShellPath("/tmp/a\nb'c")).toBe("$'/tmp/a\\x0ab\\'c'");
  });
});

describe('droppedPathsText', () => {
  it('joins quoted paths with spaces and ends with one', () => {
    expect(droppedPathsText(['/a b', '/c'])).toBe('/a\\ b /c ');
  });

  it('skips files without a path and types nothing when none are left', () => {
    expect(droppedPathsText(['', '/c'])).toBe('/c ');
    expect(droppedPathsText([''])).toBe('');
    expect(droppedPathsText([])).toBe('');
  });
});
