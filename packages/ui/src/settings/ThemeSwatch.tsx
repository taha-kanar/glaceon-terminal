import type { Theme } from '@glaceon/domain';
import type { ReactElement } from 'react';

const SAMPLE = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan'] as const;

/** A miniature terminal in the theme's colors. */
export function ThemeSwatch({ theme }: { readonly theme: Theme }): ReactElement {
  const { colors } = theme;
  return (
    <span className="swatch" style={{ background: colors.background, color: colors.foreground }}>
      <span className="swatch__prompt">
        <span style={{ color: colors.ansi.green }}>~</span> ls
      </span>
      <span className="swatch__colors">
        {SAMPLE.map((name) => (
          <span key={name} className="swatch__dot" style={{ background: colors.ansi[name] }} />
        ))}
      </span>
    </span>
  );
}
