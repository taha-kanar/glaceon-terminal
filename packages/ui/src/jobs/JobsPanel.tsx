import type { SessionInfoMap } from '@glaceon/application';
import { depthOf, type Workspace } from '@glaceon/domain';
import { useEffect, type ReactElement } from 'react';
import { useStore } from '../hooks/use-store';
import { formatCpu, formatMemory, type JobsModel } from './jobs-model';
import { paneRows } from './pane-rows';
import { useWatch } from './use-watch';

export interface JobsPanelProps {
  readonly workspace: Workspace;
  readonly sessions: SessionInfoMap;
  readonly model: JobsModel;
  readonly onClose: () => void;
}

/** Every pane's process tree, with ⌃C / terminate / kill for anything the shell started. */
export function JobsPanel({ workspace, sessions, model, onClose }: JobsPanelProps): ReactElement {
  useWatch(model.watch);
  const jobs = useStore(model.jobs);
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="backdrop backdrop--top" onMouseDown={onClose}>
      <div
        className="jobs"
        role="dialog"
        aria-label="Running jobs"
        data-testid="jobs-panel"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <header className="jobs__header">
          <span>Running jobs</span>
          <span className="jobs__hint">⎋ to close</span>
        </header>
        <div className="jobs__body">
          {paneRows(workspace, sessions).map((row) => {
            const job = jobs.get(row.pane);
            return (
              <section
                key={row.pane}
                className="jobs__pane"
                data-testid="jobs-pane"
                data-pane={row.pane}
              >
                <button
                  type="button"
                  className="jobs__pane-title"
                  onClick={() => {
                    model.focusPane(row.pane);
                    onClose();
                  }}
                >
                  <span>{row.label}</span>
                  {job !== undefined && (
                    <span className="jobs__totals">
                      {formatCpu(job.cpu)} · {formatMemory(job.memoryKb)}
                    </span>
                  )}
                </button>
                {job === undefined ? (
                  <div className="jobs__empty">…</div>
                ) : (
                  job.processes.map((process, index) => (
                    <div
                      key={process.pid}
                      className="job"
                      data-testid="job"
                      data-pid={process.pid}
                      data-name={process.name}
                      data-cpu={Math.round(process.cpu)}
                    >
                      <span className="job__pid">{process.pid}</span>
                      <span
                        className={
                          process.foreground ? 'job__name job__name--foreground' : 'job__name'
                        }
                        style={{
                          paddingLeft: `${String(depthOf(job.processes, process.pid) * 14)}px`,
                        }}
                        title={process.args}
                      >
                        {process.name}
                        {process.stopped && <span className="job__state"> stopped</span>}
                        <span className="job__args">
                          {process.args.slice(process.args.indexOf(' ') + 1 || process.args.length)}
                        </span>
                      </span>
                      <span className="job__metric">{formatCpu(process.cpu)}</span>
                      <span className="job__metric">{formatMemory(process.memoryKb)}</span>
                      <span className="job__actions">
                        {index > 0 && (
                          <>
                            <button
                              type="button"
                              title="Interrupt (SIGINT)"
                              onClick={() => {
                                model.signal(process.pid, 'SIGINT');
                              }}
                            >
                              ⌃C
                            </button>
                            <button
                              type="button"
                              title="Terminate (SIGTERM)"
                              onClick={() => {
                                model.signal(process.pid, 'SIGTERM');
                              }}
                            >
                              Stop
                            </button>
                            <button
                              type="button"
                              title="Kill (SIGKILL)"
                              className="job__kill"
                              onClick={() => {
                                model.signal(process.pid, 'SIGKILL');
                              }}
                            >
                              Kill
                            </button>
                          </>
                        )}
                      </span>
                    </div>
                  ))
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
