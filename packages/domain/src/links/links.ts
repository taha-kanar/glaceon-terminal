/** A clickable range in a logical (unwrapped) terminal line. Offsets are UTF-16 indices. */
export type TerminalLink =
  | { readonly kind: 'url'; readonly start: number; readonly end: number; readonly url: string }
  | {
      readonly kind: 'file';
      readonly start: number;
      readonly end: number;
      readonly path: string;
      readonly line?: number;
      readonly column?: number;
    };

interface Pattern {
  readonly regex: RegExp;
  readonly toLink: (match: RegExpExecArray) => TerminalLink | undefined;
}

const URL_PATTERN = /\b(?:https?|ftp):\/\/[^\s<>"'`]+|\bmailto:[^\s<>"'`]+/g;
const FILE_URL_PATTERN = /\bfile:\/\/(\/[^\s<>"'`]*?)(?::(\d+))?(?::(\d+))?(?=[\s)'"`]|$)/g;
const PYTHON_PATTERN = /File "([^"]+)", line (\d+)/g;
const TSC_PATTERN = /(?<![\w/.~-])((?:[\w.@+~-]+\/)*[\w.@+-]+\.[A-Za-z][\w]*)\((\d+),(\d+)\)/g;
/**
 * Paths with a slash (`/abs`, `./rel`, `~/x`, `dir/file.ext`) or a bare `file.ext:12`,
 * optionally followed by `:line` and `:column`. Extensions must start with a letter so
 * version numbers such as 1.2.3 are not links.
 */
const PATH_PATTERN =
  /(?<![\w/.~@+-])((?:~|\.{1,2})?\/(?:[\w.@+-]+\/)*[\w.@+-]+|(?:[\w.@+-]+\/)+[\w.@+-]*[\w@+-]\.[A-Za-z]\w*|[\w@+-][\w.@+-]*\.[A-Za-z]\w*(?=:\d))(?::(\d+))?(?::(\d+))?/g;

const TRAILING = /[.,;:!?]+$/;

function trimUrl(url: string): string {
  let trimmed = url.replace(TRAILING, '');
  // Drop a closing parenthesis that has no opening partner, e.g. "(see https://x.y/z)".
  while (
    trimmed.endsWith(')') &&
    (trimmed.match(/\(/g)?.length ?? 0) < (trimmed.match(/\)/g)?.length ?? 0)
  ) {
    trimmed = trimmed.slice(0, -1).replace(TRAILING, '');
  }
  return trimmed;
}

const toNumber = (value: string | undefined): number | undefined =>
  value === undefined ? undefined : Number.parseInt(value, 10);

function fileLink(
  start: number,
  text: string,
  parts: { path: string; line?: string | undefined; column?: string | undefined },
): TerminalLink {
  const line = toNumber(parts.line);
  const column = toNumber(parts.column);
  return {
    kind: 'file',
    start,
    end: start + text.length,
    path: parts.path,
    ...(line === undefined ? {} : { line }),
    ...(column === undefined ? {} : { column }),
  };
}

// Earlier patterns win where matches overlap.
const PATTERNS: readonly Pattern[] = [
  {
    regex: FILE_URL_PATTERN,
    toLink: (m) =>
      fileLink(m.index, m[0], { path: decodeURIComponent(m[1] ?? ''), line: m[2], column: m[3] }),
  },
  {
    regex: URL_PATTERN,
    toLink: (m) => {
      const url = trimUrl(m[0]);
      return { kind: 'url', start: m.index, end: m.index + url.length, url };
    },
  },
  {
    regex: PYTHON_PATTERN,
    toLink: (m) => fileLink(m.index, m[0], { path: m[1] ?? '', line: m[2] }),
  },
  {
    regex: TSC_PATTERN,
    toLink: (m) => fileLink(m.index, m[0], { path: m[1] ?? '', line: m[2], column: m[3] }),
  },
  {
    regex: PATH_PATTERN,
    toLink: (m) => {
      let path = m[1] ?? '';
      let text = m[0];
      if (m[2] === undefined) {
        // "see src/app.ts." — the sentence's full stop is not part of the path.
        path = path.replace(/\.+$/, '');
        text = path;
      }
      // A lone "/" or "./" is not worth a link.
      if (path.replace(/^[~.]*\//, '').length === 0) return undefined;
      return fileLink(m.index, text, { path, line: m[2], column: m[3] });
    },
  },
];

const overlaps = (a: TerminalLink, b: TerminalLink): boolean => a.start < b.end && b.start < a.end;

/** Every URL, file path and stack-trace location in a line, without overlaps, left to right. */
export function findLinks(text: string): TerminalLink[] {
  const found: TerminalLink[] = [];
  for (const { regex, toLink } of PATTERNS) {
    const pattern = new RegExp(regex.source, regex.flags);
    for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
      const link = toLink(match);
      if (link !== undefined && link.end > link.start && !found.some((f) => overlaps(f, link))) {
        found.push(link);
      }
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

function normalize(path: string): string {
  const absolute = path.startsWith('/');
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return `${absolute ? '/' : ''}${parts.join('/')}`;
}

/** Absolute path for a link: `~` is the home directory, relative paths start at `cwd`. */
export function resolveLinkPath(
  path: string,
  base: { readonly cwd: string | undefined; readonly home: string },
): string {
  if (path === '~' || path.startsWith('~/')) return normalize(`${base.home}/${path.slice(1)}`);
  if (path.startsWith('/')) return normalize(path);
  return normalize(`${base.cwd ?? base.home}/${path}`);
}
