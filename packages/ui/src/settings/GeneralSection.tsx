import type { CloseOnExit, CursorStyle, Settings } from '@glaceon/domain';
import type { ReactElement } from 'react';
import { NumberInput, Row, Select, TextInput, Toggle } from './fields';
import type { SectionProps } from './section';

const CURSOR_STYLES: readonly { value: CursorStyle; label: string }[] = [
  { value: 'block', label: 'Block' },
  { value: 'bar', label: 'Bar' },
  { value: 'underline', label: 'Underline' },
];

const CLOSE_ON_EXIT: readonly { value: CloseOnExit; label: string }[] = [
  { value: 'clean', label: 'When it exits cleanly' },
  { value: 'always', label: 'Always' },
  { value: 'never', label: 'Never' },
];

export function GeneralSection({ model, settings, report }: SectionProps): ReactElement {
  const set =
    <K extends keyof Settings>(key: K) =>
    (value: Settings[K]): void => {
      void model.update(key, value).then(report);
    };
  return (
    <div className="section">
      <h3 className="section__title">Text</h3>
      <Row label="Font family">
        <TextInput
          name="fontFamily"
          wide
          value={settings.fontFamily}
          onCommit={set('fontFamily')}
        />
      </Row>
      <Row label="Font size">
        <NumberInput
          name="fontSize"
          min={6}
          max={72}
          value={settings.fontSize}
          onCommit={set('fontSize')}
        />
      </Row>
      <Row label="Line height">
        <NumberInput
          name="lineHeight"
          min={1}
          max={3}
          step={0.05}
          value={settings.lineHeight}
          onCommit={set('lineHeight')}
        />
      </Row>
      <Row label="Letter spacing">
        <NumberInput
          name="letterSpacing"
          min={-5}
          max={20}
          value={settings.letterSpacing}
          onCommit={set('letterSpacing')}
        />
      </Row>

      <h3 className="section__title">Window</h3>
      <Row
        label="Background opacity"
        hint={`${String(Math.round(settings.backgroundOpacity * 100))}%`}
      >
        <input
          type="range"
          className="range"
          name="backgroundOpacity"
          min={0.3}
          max={1}
          step={0.05}
          value={settings.backgroundOpacity}
          onChange={(event) => {
            set('backgroundOpacity')(Number(event.target.value));
          }}
        />
      </Row>

      <h3 className="section__title">Cursor</h3>
      <Row label="Style">
        <Select
          name="cursorStyle"
          value={settings.cursorStyle}
          options={CURSOR_STYLES}
          onChange={set('cursorStyle')}
        />
      </Row>
      <Row label="Blink">
        <Toggle name="cursorBlink" checked={settings.cursorBlink} onChange={set('cursorBlink')} />
      </Row>

      <h3 className="section__title">Behaviour</h3>
      <Row label="Scrollback lines">
        <NumberInput
          name="scrollback"
          min={0}
          max={1_000_000}
          value={settings.scrollback}
          onCommit={set('scrollback')}
        />
      </Row>
      <Row label="Option key sends Meta" hint="Off: ⌥ types characters such as @">
        <Toggle
          name="macOptionIsMeta"
          checked={settings.macOptionIsMeta}
          onChange={set('macOptionIsMeta')}
        />
      </Row>
      <Row label="Copy on select">
        <Toggle
          name="copyOnSelect"
          checked={settings.copyOnSelect}
          onChange={set('copyOnSelect')}
        />
      </Row>
      <Row label="Ask before closing running programs">
        <Toggle
          name="confirmCloseRunningProcess"
          checked={settings.confirmCloseRunningProcess}
          onChange={set('confirmCloseRunningProcess')}
        />
      </Row>
      <Row label="Close pane when the shell exits">
        <Select
          name="closeOnExit"
          value={settings.closeOnExit}
          options={CLOSE_ON_EXIT}
          onChange={set('closeOnExit')}
        />
      </Row>

      <h3 className="section__title">Links</h3>
      <Row label="Editor command" hint="{file} {line} {col}">
        <TextInput
          name="editorCommand"
          wide
          value={settings.editorCommand}
          onCommit={set('editorCommand')}
        />
      </Row>
      <div className="section__footer">
        <button type="button" className="button" onClick={model.openSettingsFile}>
          Open config.json
        </button>
      </div>
    </div>
  );
}
