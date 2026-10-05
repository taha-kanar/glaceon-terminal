import { describe, expect, it } from 'vitest';
import {
  chordId,
  chordsFromKeyInput,
  formatChord,
  parseChord,
  sameChord,
  type KeyInput,
} from './key-chord';

const input = (over: Partial<KeyInput>): KeyInput => ({
  key: 'a',
  code: 'KeyA',
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...over,
});

describe('parseChord', () => {
  it('parses modifiers in any order and spelling', () => {
    expect(parseChord('Cmd+Shift+D')).toEqual({
      key: 'd',
      meta: true,
      ctrl: false,
      alt: false,
      shift: true,
    });
    expect(parseChord('option+command+ArrowLeft')).toMatchObject({
      key: 'left',
      meta: true,
      alt: true,
    });
    expect(parseChord('ctrl+tab')).toMatchObject({ key: 'tab', ctrl: true });
    expect(parseChord('cmd++')).toMatchObject({ key: '+', meta: true });
    expect(parseChord('cmd+plus')).toMatchObject({ key: '+' });
    expect(parseChord('F5')).toMatchObject({ key: 'f5' });
  });

  it('rejects malformed chords', () => {
    expect(parseChord('')).toBeUndefined();
    expect(parseChord('hyper+d')).toBeUndefined();
    expect(parseChord('cmd+')).toBeUndefined();
    expect(parseChord('cmd+abc')).toBeUndefined();
  });

  it('round-trips through the canonical id and formats like macOS menus', () => {
    const chord = parseChord('shift+cmd+ctrl+alt+enter');
    if (chord === undefined) throw new Error('expected a chord');
    expect(chordId(chord)).toBe('ctrl+alt+shift+meta+enter');
    expect(formatChord(chord)).toBe('⌃⌥⇧⌘↩');
    expect(formatChord({ key: 'd', meta: true, ctrl: false, alt: false, shift: false })).toBe('⌘D');
    expect(sameChord(chord, parseChord('ctrl+alt+shift+cmd+return') ?? chord)).toBe(true);
  });
});

describe('chordsFromKeyInput', () => {
  it('ignores bare modifier presses', () => {
    expect(chordsFromKeyInput(input({ key: 'Meta', code: 'MetaLeft', metaKey: true }))).toEqual([]);
  });

  it('uses the typed character first and the physical key second', () => {
    const chords = chordsFromKeyInput(
      input({ key: '{', code: 'BracketLeft', metaKey: true, shiftKey: true }),
    );
    expect(chords.map(chordId)).toEqual(['shift+meta+{', 'shift+meta+[']);
  });

  it('falls back to the US key on a Turkish Q layout', () => {
    // ⌘⌥ + the key labelled "ı" on Turkish Q.
    const chords = chordsFromKeyInput(
      input({ key: 'ı', code: 'KeyI', metaKey: true, altKey: true }),
    );
    expect(chords.map(chordId)).toContain('alt+meta+i');
    // Option produces a dead/special character; the physical key still matches.
    const option = chordsFromKeyInput(
      input({ key: '∂', code: 'KeyD', metaKey: true, altKey: true }),
    );
    expect(option.map(chordId)).toEqual(['alt+meta+∂', 'alt+meta+d']);
  });

  it('normalizes named keys and does not duplicate identical candidates', () => {
    expect(chordsFromKeyInput(input({ key: 'ArrowLeft', code: 'ArrowLeft' })).map(chordId)).toEqual(
      ['left'],
    );
    expect(
      chordsFromKeyInput(input({ key: 'D', code: 'KeyD', shiftKey: true })).map(chordId),
    ).toEqual(['shift+d']);
    expect(chordsFromKeyInput(input({ key: 'Unidentified', code: 'F13' })).map(chordId)).toEqual([
      'f13',
    ]);
    expect(chordsFromKeyInput(input({ key: '1', code: 'Numpad1' })).map(chordId)).toEqual(['1']);
  });
});
