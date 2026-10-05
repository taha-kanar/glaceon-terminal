import { clipPreview } from '@glaceon/domain';
import { useState, type ReactElement } from 'react';
import { useStore } from '../hooks/use-store';
import type { ToolsModel } from './tools-model';

export interface ClipboardPickerProps {
  readonly model: ToolsModel;
  readonly onClose: () => void;
}

/** ⌘⇧V: the last ten clips. 1–9 paste at once, arrows and Enter choose, Escape closes. */
export function ClipboardPicker({ model, onClose }: ClipboardPickerProps): ReactElement {
  const ring = useStore(model.ring);
  const [selected, setSelected] = useState(0);
  const current = Math.min(selected, Math.max(0, ring.length - 1));
  const pick = (index: number): void => {
    const text = ring[index];
    if (text !== undefined) model.paste(text);
  };

  return (
    <div className="backdrop backdrop--top" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-label="Clipboard history"
        data-testid="clipboard-picker"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <input
          className="palette__input"
          autoFocus
          readOnly
          aria-label="Clipboard history"
          value=""
          placeholder="Clipboard history — press 1–9, or choose with ↑↓ and ↩"
          onKeyDown={(event) => {
            if (/^[1-9]$/.test(event.key)) pick(Number(event.key) - 1);
            else if (event.key === '0') pick(9);
            else if (event.key === 'ArrowDown')
              setSelected((current + 1) % Math.max(1, ring.length));
            else if (event.key === 'ArrowUp')
              setSelected((current - 1 + ring.length) % Math.max(1, ring.length));
            else if (event.key === 'Enter') pick(current);
            else if (event.key === 'Escape') onClose();
            else return;
            event.preventDefault();
          }}
        />
        <ul className="palette__list" role="listbox">
          {ring.map((text, index) => (
            <li
              key={`${String(index)}:${text}`}
              role="option"
              aria-selected={index === current}
              className={
                index === current ? 'palette__item palette__item--selected' : 'palette__item'
              }
              data-testid="clip"
              onMouseMove={() => {
                if (index !== current) setSelected(index);
              }}
              onClick={() => {
                pick(index);
              }}
            >
              <kbd className="palette__key">{index < 9 ? index + 1 : 0}</kbd>
              <span className="palette__label">{clipPreview(text)}</span>
            </li>
          ))}
          {ring.length === 0 && <li className="palette__empty">Nothing copied yet</li>}
        </ul>
      </div>
    </div>
  );
}
