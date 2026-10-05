import type { ReactElement } from 'react';

/** Text with the characters at `indices` wrapped in <mark>. */
export function Highlighted({
  text,
  indices,
}: {
  readonly text: string;
  readonly indices: readonly number[];
}): ReactElement {
  if (indices.length === 0) return <>{text}</>;
  const marked = new Set(indices);
  const parts: ReactElement[] = [];
  let run = '';
  let runMarked = false;
  const flush = (key: number): void => {
    if (run === '') return;
    parts.push(runMarked ? <mark key={key}>{run}</mark> : <span key={key}>{run}</span>);
    run = '';
  };
  // UTF-16 indices, the same units fuzzyMatch reports.
  for (let i = 0; i < text.length; i++) {
    const isMarked = marked.has(i);
    if (isMarked !== runMarked) {
      flush(i);
      runMarked = isMarked;
    }
    run += text.charAt(i);
  }
  flush(text.length);
  return <>{parts}</>;
}
