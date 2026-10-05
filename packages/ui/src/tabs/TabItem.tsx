import type { Tab, TabGroup } from '@glaceon/domain';
import type { CSSProperties, MouseEvent, PointerEvent, ReactElement } from 'react';
import { ElapsedBadge } from './ElapsedBadge';
import { RenameInput } from './RenameInput';

export interface TabItemProps {
  readonly tab: Tab;
  readonly position: number;
  readonly title: string;
  readonly active: boolean;
  readonly group: TabGroup | undefined;
  readonly panes: number;
  /** When the active pane's foreground program started, while one runs. */
  readonly busySince: number | undefined;
  readonly renaming: boolean;
  readonly dragging: boolean;
  readonly onSelect: () => void;
  readonly onClose: () => void;
  readonly onRename: () => void;
  readonly onCommitRename: (name: string) => void;
  readonly onCancelRename: () => void;
  readonly onMenu: (event: MouseEvent) => void;
  readonly onPointerDown: (event: PointerEvent) => void;
}

function LockIcon(): ReactElement {
  return (
    <svg className="tab__lock" viewBox="0 0 16 16" aria-label="Locked" role="img">
      <path
        d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2h.5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm1.5 0h4V5a2 2 0 0 0-4 0z"
        fill="currentColor"
      />
    </svg>
  );
}

export function TabItem(props: TabItemProps): ReactElement {
  const { tab, position, title, active, group, panes, renaming } = props;
  const classes = ['tab'];
  if (active) classes.push('tab--active');
  if (tab.pinned) classes.push('tab--pinned');
  if (group !== undefined) classes.push('tab--grouped');
  if (props.dragging) classes.push('tab--dragging');
  const color = tab.color ?? group?.color;
  const style = (
    color === undefined ? {} : { '--tab-color': `var(--tab-${color})` }
  ) as CSSProperties;
  const closable = !tab.pinned && !tab.locked;

  return (
    <div
      role="tab"
      aria-selected={active}
      className={classes.join(' ')}
      style={style}
      title={tab.pinned ? title : undefined}
      data-testid="tab"
      data-tab-id={tab.id}
      data-pinned={tab.pinned}
      data-locked={tab.locked}
      data-color={tab.color}
      onMouseDown={(event) => {
        if (event.button === 1) {
          event.preventDefault();
          if (closable) props.onClose();
        } else if (event.button === 0) {
          props.onSelect();
        }
      }}
      onPointerDown={props.onPointerDown}
      onDoubleClick={props.onRename}
      onContextMenu={(event) => {
        event.preventDefault();
        props.onMenu(event);
      }}
    >
      {color !== undefined && <span className="tab__color" />}
      {position <= 9 && <span className="tab__index">{position}</span>}
      {renaming ? (
        <RenameInput
          initial={tab.title ?? title}
          label="Tab name"
          onCommit={props.onCommitRename}
          onCancel={props.onCancelRename}
        />
      ) : (
        !tab.pinned && <span className="tab__title">{title}</span>
      )}
      {tab.locked && <LockIcon />}
      {props.busySince !== undefined && !tab.pinned && <ElapsedBadge since={props.busySince} />}
      {panes > 1 && !tab.pinned && <span className="tab__badge">{panes}</span>}
      {closable && (
        <button
          type="button"
          className="tab__close"
          aria-label="Close tab"
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={props.onClose}
        >
          ×
        </button>
      )}
    </div>
  );
}
