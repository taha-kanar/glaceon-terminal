import type { KeyChord } from '@glaceon/domain';

const KEY_NAMES: Readonly<Record<string, string>> = {
  left: 'Left',
  right: 'Right',
  up: 'Up',
  down: 'Down',
  enter: 'Enter',
  tab: 'Tab',
  escape: 'Escape',
  space: 'Space',
  backspace: 'Backspace',
  delete: 'Delete',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  '+': 'Plus',
};

/** Electron accelerator syntax (`Cmd+Shift+D`) for menu labels. */
export function toElectronAccelerator(chord: KeyChord): string {
  const key = KEY_NAMES[chord.key] ?? chord.key.toUpperCase();
  return [
    chord.ctrl ? 'Ctrl' : '',
    chord.alt ? 'Alt' : '',
    chord.shift ? 'Shift' : '',
    chord.meta ? 'Cmd' : '',
    key,
  ]
    .filter((part) => part.length > 0)
    .join('+');
}
