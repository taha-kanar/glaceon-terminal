/** Characters a shell would read as syntax; escaped with a backslash, as macOS Terminal does. */
const SPECIAL = /[ \t'"\\$`!&(){}[\]|;<>?*#~=%,^]/g;
/** Control characters (newlines in file names) need ANSI-C quoting to survive. */
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;

function ansiC(path: string): string {
  const body = Array.from(path, (char) => {
    if (char === '\\' || char === "'") return `\\${char}`;
    const code = char.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return `\\x${code.toString(16).padStart(2, '0')}`;
    return char;
  }).join('');
  return `$'${body}'`;
}

/** One path, quoted so a shell reads it back as a single word. */
export function quoteShellPath(path: string): string {
  if (CONTROL.test(path)) return ansiC(path);
  return path.replace(SPECIAL, '\\$&');
}

/** What dropping files on a pane types: quoted paths, space separated, with a trailing space. */
export function droppedPathsText(paths: readonly string[]): string {
  const words = paths.filter((path) => path !== '').map(quoteShellPath);
  return words.length === 0 ? '' : `${words.join(' ')} `;
}
