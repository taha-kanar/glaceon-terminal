import type { SessionInfoMap } from '@glaceon/application';
import type { Workspace } from '@glaceon/domain';
import { useState, type ReactElement } from 'react';
import { useStore } from '../hooks/use-store';
import { formatCpu, formatMemory, type JobsModel } from './jobs-model';
import { paneRows } from './pane-rows';
import { useWatch } from './use-watch';

export interface ProcessPopoverProps {
  readonly workspace: Workspace;
  readonly sessions: SessionInfoMap;
  readonly model: JobsModel;
}

function PopoverList({ workspace, sessions, model }: ProcessPopoverProps): ReactElement {
  useWatch(model.watch);
  const jobs = useStore(model.jobs);
  return (
    <div
      className="process-popover"
      role="dialog"
      aria-label="Processes"
      data-testid="process-popover"
    >
      {paneRows(workspace, sessions).map((row) => {
        const job = jobs.get(row.pane);
        const info = sessions.get(row.pane);
        return (
          <button
            key={row.pane}
            type="button"
            className={row.active ? 'process-row process-row--active' : 'process-row'}
            data-testid="process-row"
            data-pane={row.pane}
            onClick={() => {
              model.focusPane(row.pane);
            }}
          >
            <span className="process-row__label">{row.label}</span>
            <span
              className={
                info?.busy === true
                  ? 'process-row__name process-row__name--busy'
                  : 'process-row__name'
              }
            >
              {info?.process ?? info?.shell ?? '—'}
            </span>
            <span className="process-row__metric">
              {job === undefined ? '…' : formatCpu(job.cpu)}
            </span>
            <span className="process-row__metric">
              {job === undefined ? '' : formatMemory(job.memoryKb)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Title bar indicator: how many panes run something; hover lists every pane with CPU and memory. */
export function ProcessIndicator(props: ProcessPopoverProps): ReactElement {
  const [open, setOpen] = useState(false);
  const busy = [...props.sessions.values()].filter((info) => info.busy === true).length;
  return (
    <div
      className="process-indicator"
      data-testid="process-indicator"
      onMouseEnter={() => {
        setOpen(true);
      }}
      onMouseLeave={() => {
        setOpen(false);
      }}
    >
      <span
        className={
          busy > 0
            ? 'process-indicator__dot process-indicator__dot--busy'
            : 'process-indicator__dot'
        }
      />
      <span className="process-indicator__label">
        {busy === 0 ? 'idle' : `${String(busy)} running`}
      </span>
      {open && <PopoverList {...props} />}
    </div>
  );
}
