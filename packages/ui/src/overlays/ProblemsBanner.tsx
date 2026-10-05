import type { ReactElement } from 'react';

export interface ProblemsBannerProps {
  readonly problems: readonly string[];
  readonly onOpenSettings: () => void;
}

export function ProblemsBanner({ problems, onOpenSettings }: ProblemsBannerProps): ReactElement {
  return (
    <div className="banner" role="alert" data-testid="settings-problems">
      <div className="banner__text">
        <strong>Settings could not be applied.</strong> The last working settings are still in use.
        <ul className="banner__list">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </div>
      <button type="button" className="button" onClick={onOpenSettings}>
        Open settings file
      </button>
    </div>
  );
}
