import { chordsFromKeyInput, formatChord, toChordSpec, type KeyChord } from '@glaceon/domain';
import { useState, type ReactElement } from 'react';

export interface KeyRecorderProps {
  readonly onRecord: (spec: string) => void;
  readonly onCancel: () => void;
  readonly setCapture: (capturing: boolean) => void;
}

/** Records one key chord. Shortcuts are suspended while it has focus. */
export function KeyRecorder({ onRecord, onCancel, setCapture }: KeyRecorderProps): ReactElement {
  const [preview, setPreview] = useState<KeyChord | undefined>(undefined);
  return (
    <input
      className="input recorder"
      autoFocus
      readOnly
      aria-label="Press a key combination"
      placeholder="Press keys… (Esc cancels)"
      value={preview === undefined ? '' : formatChord(preview)}
      onFocus={() => {
        setCapture(true);
      }}
      onBlur={() => {
        setCapture(false);
        onCancel();
      }}
      onKeyDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'Escape' && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.currentTarget.blur();
          return;
        }
        const candidates = chordsFromKeyInput(event);
        // Prefer the physical key: ⌘⇧[ should be stored as cmd+shift+[ rather than cmd+shift+{.
        const chord = candidates.at(-1);
        if (chord === undefined) return;
        setPreview(chord);
        setCapture(false);
        onRecord(toChordSpec(chord));
      }}
    />
  );
}
