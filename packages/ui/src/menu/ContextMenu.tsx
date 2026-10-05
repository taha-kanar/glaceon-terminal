import { TAB_COLORS, type TabColor } from '@glaceon/domain';
import { useEffect, useRef, type ReactElement } from 'react';

export type MenuEntry =
  | {
      readonly kind: 'item';
      readonly label: string;
      readonly onSelect: () => void;
      readonly disabled?: boolean;
    }
  | {
      readonly kind: 'colors';
      readonly value: TabColor | undefined;
      /** Whether "no color" is offered. */
      readonly allowNone: boolean;
      readonly onSelect: (color: TabColor | undefined) => void;
    }
  | { readonly kind: 'separator' };

export interface ContextMenuProps {
  readonly x: number;
  readonly y: number;
  readonly entries: readonly MenuEntry[];
  readonly onClose: () => void;
}

/** A small themed menu at the pointer; closes on outside clicks, Escape and after a choice. */
export function ContextMenu({ x, y, entries, onClose }: ContextMenuProps): ReactElement {
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onPointer = (event: PointerEvent): void => {
      if (!(event.target instanceof Node) || menu.current?.contains(event.target) !== true) {
        onClose();
      }
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  const choose = (action: () => void): void => {
    onClose();
    action();
  };

  return (
    <div
      ref={menu}
      className="menu"
      role="menu"
      style={{ left: x, top: y }}
      data-testid="context-menu"
    >
      {entries.map((entry, index) => {
        switch (entry.kind) {
          case 'separator':
            return <div key={index} className="menu__separator" role="separator" />;
          case 'colors':
            return (
              <div key={index} className="menu__colors">
                {[...(entry.allowNone ? [undefined] : []), ...TAB_COLORS].map((color) => (
                  <button
                    key={color ?? 'none'}
                    type="button"
                    role="menuitemradio"
                    aria-checked={entry.value === color}
                    aria-label={color ?? 'No color'}
                    title={color ?? 'No color'}
                    className={
                      color === undefined ? 'menu__color menu__color--none' : 'menu__color'
                    }
                    style={color === undefined ? undefined : { background: `var(--tab-${color})` }}
                    onClick={() => {
                      choose(() => {
                        entry.onSelect(color);
                      });
                    }}
                  />
                ))}
              </div>
            );
          case 'item':
            return (
              <button
                key={index}
                type="button"
                role="menuitem"
                className="menu__item"
                disabled={entry.disabled}
                onClick={() => {
                  choose(entry.onSelect);
                }}
              >
                {entry.label}
              </button>
            );
        }
      })}
    </div>
  );
}
