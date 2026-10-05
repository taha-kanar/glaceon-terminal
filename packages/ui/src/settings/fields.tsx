import { useState, type ReactElement, type ReactNode } from 'react';

export function Row({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <label className="field">
      <span className="field__label">
        {label}
        {hint !== undefined && <span className="field__hint">{hint}</span>}
      </span>
      <span className="field__control">{children}</span>
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  name,
}: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly name: string;
}): ReactElement {
  return (
    <input
      type="checkbox"
      role="switch"
      className="toggle"
      name={name}
      checked={checked}
      onChange={(event) => {
        onChange(event.target.checked);
      }}
    />
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  name,
}: {
  readonly value: T;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly onChange: (value: T) => void;
  readonly name: string;
}): ReactElement {
  return (
    <select
      className="input"
      name={name}
      value={value}
      onChange={(event) => {
        const next = options.find((option) => option.value === event.target.value);
        if (next !== undefined) onChange(next.value);
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** Text input that commits on Enter or blur, so the file is not rewritten per keystroke. */
function TextInputDraft({
  value,
  onCommit,
  name,
  wide = false,
}: {
  readonly value: string;
  readonly onCommit: (value: string) => void;
  readonly name: string;
  readonly wide?: boolean;
}): ReactElement {
  const [draft, setDraft] = useState(value);
  const commit = (): void => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <input
      className={wide ? 'input input--wide' : 'input'}
      name={name}
      spellCheck={false}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
      }}
    />
  );
}

function NumberInputDraft({
  value,
  onCommit,
  name,
  min,
  max,
  step = 1,
}: {
  readonly value: number;
  readonly onCommit: (value: number) => void;
  readonly name: string;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
}): ReactElement {
  const [draft, setDraft] = useState(String(value));
  const commit = (): void => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed >= min && parsed <= max && parsed !== value) {
      onCommit(parsed);
    } else {
      setDraft(String(value));
    }
  };
  return (
    <input
      type="number"
      className="input input--number"
      name={name}
      min={min}
      max={max}
      step={step}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
      }}
    />
  );
}

type TextInputProps = Parameters<typeof TextInputDraft>[0];
type NumberInputProps = Parameters<typeof NumberInputDraft>[0];

// Keyed by the committed value: an outside change (e.g. the file was edited) resets the draft.
export function TextInput(props: TextInputProps): ReactElement {
  return <TextInputDraft key={props.value} {...props} />;
}

export function NumberInput(props: NumberInputProps): ReactElement {
  return <NumberInputDraft key={props.value} {...props} />;
}
