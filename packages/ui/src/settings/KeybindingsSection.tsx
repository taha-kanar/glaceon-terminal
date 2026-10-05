import {
  chordId,
  fuzzyFilter,
  parseChord,
  rebindKeybinding,
  resetKeybinding,
  unbindKeybinding,
  type KeybindingEntry,
} from '@glaceon/domain';
import { useState, type ReactElement } from 'react';
import { useStore } from '../hooks/use-store';
import { KeyRecorder } from './KeyRecorder';
import type { SectionProps } from './section';

const labelOf = (command: { title: string; category?: string }): string =>
  command.category === undefined ? command.title : `${command.category}: ${command.title}`;

export function KeybindingsSection({ model, settings, report }: SectionProps): ReactElement {
  const resolver = useStore(model.keybindings.resolver);
  const [filter, setFilter] = useState('');
  const [recording, setRecording] = useState<string | undefined>(undefined);
  const commands = model.keybindings.commands().filter((command) => command.hideInPalette !== true);
  const customized = new Set(settings.keybindings.map((entry) => entry.command.replace(/^-/, '')));

  const write = (next: KeybindingEntry[]): void => {
    void model.update('keybindings', next).then(report);
  };

  /** Other commands already bound to the chord a command uses. */
  const conflictsOf = (command: string): string[] => {
    const chord = resolver.chordFor(command);
    if (chord === undefined) return [];
    const id = chordId(chord);
    return resolver
      .all()
      .filter((binding) => binding.command !== command && chordId(binding.chord) === id)
      .map((binding) => commands.find((c) => c.id === binding.command))
      .filter((c) => c !== undefined)
      .map(labelOf);
  };

  return (
    <div className="section">
      <input
        className="input input--wide section__search"
        placeholder="Search commands"
        aria-label="Search commands"
        value={filter}
        onChange={(event) => {
          setFilter(event.target.value);
        }}
      />
      <ul className="keybindings">
        {fuzzyFilter(commands, filter, labelOf).map(({ item: command }) => {
          const label = resolver.labelFor(command.id);
          const conflicts = conflictsOf(command.id);
          return (
            <li key={command.id} className="keybinding" data-testid={`keybinding-${command.id}`}>
              <span className="keybinding__title">
                {labelOf(command)}
                {conflicts.length > 0 && (
                  <span className="keybinding__conflict">Also bound to {conflicts.join(', ')}</span>
                )}
              </span>
              {recording === command.id ? (
                <KeyRecorder
                  setCapture={model.keybindings.setCapture}
                  onCancel={() => {
                    setRecording(undefined);
                  }}
                  onRecord={(key) => {
                    setRecording(undefined);
                    if (parseChord(key) !== undefined) {
                      write(rebindKeybinding(settings.keybindings, { command: command.id, key }));
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="keycap"
                  title="Click to change"
                  onClick={() => {
                    setRecording(command.id);
                  }}
                >
                  {label ?? '—'}
                </button>
              )}
              <span className="keybinding__actions">
                {label !== undefined && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      write(unbindKeybinding(settings.keybindings, command.id));
                    }}
                  >
                    Remove
                  </button>
                )}
                {customized.has(command.id) && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      write(resetKeybinding(settings.keybindings, command.id));
                    }}
                  >
                    Reset
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
