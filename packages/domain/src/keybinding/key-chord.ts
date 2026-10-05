/** A key plus modifiers. `key` is normalized: lower-case characters or names such as `left`. */
export interface KeyChord {
  readonly key: string;
  readonly meta: boolean;
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
}

/** The fields of a DOM KeyboardEvent that chord matching needs. */
export interface KeyInput {
  readonly key: string;
  readonly code: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}

const MODIFIER_ALIASES: Readonly<Record<string, 'meta' | 'ctrl' | 'alt' | 'shift'>> = {
  cmd: 'meta',
  command: 'meta',
  meta: 'meta',
  super: 'meta',
  '⌘': 'meta',
  ctrl: 'ctrl',
  control: 'ctrl',
  '⌃': 'ctrl',
  alt: 'alt',
  option: 'alt',
  opt: 'alt',
  '⌥': 'alt',
  shift: 'shift',
  '⇧': 'shift',
};

const KEY_ALIASES: Readonly<Record<string, string>> = {
  arrowleft: 'left',
  arrowright: 'right',
  arrowup: 'up',
  arrowdown: 'down',
  return: 'enter',
  esc: 'escape',
  ' ': 'space',
  spacebar: 'space',
  del: 'delete',
  plus: '+',
  minus: '-',
};

const NAMED_KEYS = new Set([
  'left',
  'right',
  'up',
  'down',
  'enter',
  'tab',
  'escape',
  'space',
  'backspace',
  'delete',
  'home',
  'end',
  'pageup',
  'pagedown',
  ...Array.from({ length: 20 }, (_, i) => `f${String(i + 1)}`),
]);

function normalizeKey(raw: string): string | undefined {
  const lower = raw.toLowerCase();
  const key = KEY_ALIASES[lower] ?? lower;
  if (NAMED_KEYS.has(key)) return key;
  return Array.from(key).length === 1 ? key : undefined;
}

/** Parses `cmd+shift+d`, `Ctrl+Tab`, `cmd++` … Returns undefined for malformed input. */
export function parseChord(text: string): KeyChord | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) return undefined;
  const parts = trimmed.endsWith('++')
    ? [...trimmed.slice(0, -2).split('+'), '+']
    : trimmed.split('+');
  const keyPart = parts.pop();
  if (keyPart === undefined) return undefined;
  const chord = { key: '', meta: false, ctrl: false, alt: false, shift: false };
  for (const part of parts) {
    const modifier = MODIFIER_ALIASES[part.trim().toLowerCase()];
    if (modifier === undefined) return undefined;
    chord[modifier] = true;
  }
  const key = normalizeKey(keyPart.trim() === '' ? keyPart : keyPart.trim());
  if (key === undefined) return undefined;
  chord.key = key;
  return chord;
}

/** Canonical string used as a lookup key: `ctrl+alt+shift+meta+key`. */
export function chordId(chord: KeyChord): string {
  return [
    chord.ctrl ? 'ctrl' : '',
    chord.alt ? 'alt' : '',
    chord.shift ? 'shift' : '',
    chord.meta ? 'meta' : '',
    chord.key,
  ]
    .filter((part) => part.length > 0)
    .join('+');
}

export function sameChord(a: KeyChord, b: KeyChord): boolean {
  return chordId(a) === chordId(b);
}

/** The config.json spelling of a chord, e.g. `cmd+shift+d`; `parseChord` reads it back. */
export function toChordSpec(chord: KeyChord): string {
  return [
    chord.ctrl ? 'ctrl' : '',
    chord.alt ? 'alt' : '',
    chord.shift ? 'shift' : '',
    chord.meta ? 'cmd' : '',
    chord.key,
  ]
    .filter((part) => part.length > 0)
    .join('+');
}

const KEY_SYMBOLS: Readonly<Record<string, string>> = {
  left: '←',
  right: '→',
  up: '↑',
  down: '↓',
  enter: '↩',
  tab: '⇥',
  escape: '⎋',
  backspace: '⌫',
  delete: '⌦',
  space: 'Space',
  pageup: '⇞',
  pagedown: '⇟',
  home: '↖',
  end: '↘',
};

/** macOS menu style: `⌃⌥⇧⌘D`. */
export function formatChord(chord: KeyChord): string {
  const key = KEY_SYMBOLS[chord.key] ?? chord.key.toUpperCase();
  return `${chord.ctrl ? '⌃' : ''}${chord.alt ? '⌥' : ''}${chord.shift ? '⇧' : ''}${chord.meta ? '⌘' : ''}${key}`;
}

const CODE_KEYS: Readonly<Record<string, string>> = {
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Space: 'space',
  Enter: 'enter',
  NumpadEnter: 'enter',
  Tab: 'tab',
  Escape: 'escape',
  Backspace: 'backspace',
  Delete: 'delete',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  NumpadAdd: '+',
  NumpadSubtract: '-',
};

/** The US-layout key printed on the physical key, from `KeyboardEvent.code`. */
function keyFromCode(code: string): string | undefined {
  const letter = /^Key([A-Z])$/.exec(code)?.[1];
  if (letter !== undefined) return letter.toLowerCase();
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(code)?.[1];
  if (digit !== undefined) return digit;
  const fn = /^F(\d{1,2})$/.exec(code)?.[1];
  if (fn !== undefined) return `f${fn}`;
  return CODE_KEYS[code];
}

const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift', 'CapsLock', 'Fn', 'AltGraph']);

/**
 * Chords a key press may stand for, best match first: the layout's character, then the
 * physical US key. The fallback makes `⌘⇧[` and `⌘⌥` letter shortcuts work on layouts such
 * as Turkish Q, where those keys produce other characters.
 */
export function chordsFromKeyInput(input: KeyInput): KeyChord[] {
  if (MODIFIER_KEYS.has(input.key)) return [];
  const modifiers = {
    meta: input.metaKey,
    ctrl: input.ctrlKey,
    alt: input.altKey,
    shift: input.shiftKey,
  };
  const keys = [normalizeKey(input.key), keyFromCode(input.code)].filter(
    (key, index, all): key is string => key !== undefined && all.indexOf(key) === index,
  );
  return keys.map((key) => ({ key, ...modifiers }));
}
