import { useEffect, useState, type ReactElement } from 'react';

/** `12s`, `4:05`, `1:02:03`. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number): string => String(value).padStart(2, '0');
  if (hours > 0) return `${String(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (minutes > 0) return `${String(minutes)}:${pad(seconds)}`;
  return `${String(seconds)}s`;
}

/** How long the tab's foreground program has been running, ticking every second. */
export function ElapsedBadge({
  since,
  now = Date.now,
}: {
  readonly since: number;
  readonly now?: () => number;
}): ReactElement {
  const [current, setCurrent] = useState(now);
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent(now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [now]);
  return (
    <span className="tab__elapsed" data-testid="tab-elapsed">
      {formatElapsed(current - since)}
    </span>
  );
}
