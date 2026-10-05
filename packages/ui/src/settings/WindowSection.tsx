import type { BackgroundImageFit, Settings } from '@glaceon/domain';
import type { ReactElement } from 'react';
import { Row, Select, TextInput, Toggle } from './fields';
import type { SectionProps } from './section';

const FITS: readonly { value: BackgroundImageFit; label: string }[] = [
  { value: 'cover', label: 'Cover' },
  { value: 'contain', label: 'Contain' },
  { value: 'fill', label: 'Stretch' },
];

const percent = (value: number): string => `${String(Math.round(value * 100))}%`;

function Range({
  name,
  min,
  value,
  onChange,
}: {
  readonly name: string;
  readonly min: number;
  readonly value: number;
  readonly onChange: (value: number) => void;
}): ReactElement {
  return (
    <input
      type="range"
      className="range"
      name={name}
      min={min}
      max={1}
      step={0.01}
      value={value}
      onChange={(event) => {
        onChange(Number(event.target.value));
      }}
    />
  );
}

/** Transparency, frosted glass and what is painted behind the terminal. */
export function WindowSection({ model, settings, report }: SectionProps): ReactElement {
  const set =
    <K extends keyof Settings>(key: K) =>
    (value: Settings[K]): void => {
      void model.update(key, value).then(report);
    };
  const image = settings.backgroundImage;
  return (
    <div className="section">
      <h3 className="section__title">Transparency</h3>
      <Row label="Background opacity" hint={percent(settings.backgroundOpacity)}>
        <Range
          name="backgroundOpacity"
          min={0.1}
          value={settings.backgroundOpacity}
          onChange={set('backgroundOpacity')}
        />
      </Row>
      <Row label="Frosted glass" hint="Blur what is behind the window">
        <Toggle
          name="backgroundBlur"
          checked={settings.backgroundBlur}
          onChange={set('backgroundBlur')}
        />
      </Row>

      <h3 className="section__title">Background</h3>
      <Row label="Color" hint="Painted behind the terminal">
        <span className="field__inline">
          <input
            type="color"
            className="color-input"
            name="backgroundColor"
            value={settings.backgroundColor === '' ? '#1a1b26' : settings.backgroundColor}
            onChange={(event) => {
              set('backgroundColor')(event.target.value);
            }}
          />
          {settings.backgroundColor !== '' && (
            <button
              type="button"
              className="button"
              onClick={() => {
                set('backgroundColor')('');
              }}
            >
              None
            </button>
          )}
        </span>
      </Row>
      <Row label="Image" hint={image === '' ? 'None' : image.slice(image.lastIndexOf('/') + 1)}>
        <span className="field__inline">
          <button
            type="button"
            className="button"
            data-testid="choose-background"
            onClick={() => {
              void model.chooseBackgroundImage().then((path) => {
                if (path !== undefined) set('backgroundImage')(path);
              });
            }}
          >
            Choose…
          </button>
          {image !== '' && (
            <button
              type="button"
              className="button"
              onClick={() => {
                set('backgroundImage')('');
              }}
            >
              Remove
            </button>
          )}
        </span>
      </Row>
      <Row label="Image path">
        <TextInput name="backgroundImage" value={image} wide onCommit={set('backgroundImage')} />
      </Row>
      {image !== '' && (
        <>
          <Row label="Fit">
            <Select
              name="backgroundImageFit"
              value={settings.backgroundImageFit}
              options={FITS}
              onChange={set('backgroundImageFit')}
            />
          </Row>
          <Row label="Image opacity" hint={percent(settings.backgroundImageOpacity)}>
            <Range
              name="backgroundImageOpacity"
              min={0.05}
              value={settings.backgroundImageOpacity}
              onChange={set('backgroundImageOpacity')}
            />
          </Row>
        </>
      )}
    </div>
  );
}
