export interface EditorTarget {
  readonly file: string;
  readonly line: number;
  readonly column: number;
}

/** Splits a command template into words, honouring '…' and "…" quoting (no shell involved). */
export function splitCommand(template: string): string[] {
  const words: string[] = [];
  let current = '';
  let quote: '"' | "'" | undefined;
  let started = false;
  for (const char of template) {
    if (quote !== undefined) {
      if (char === quote) quote = undefined;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started || current !== '') words.push(current);
      current = '';
      started = false;
    } else {
      current += char;
    }
  }
  if (started || current !== '') words.push(current);
  return words;
}

/**
 * The argv that opens `target` in the configured editor. Placeholders are substituted inside
 * words after splitting, so file names with spaces or quotes stay one argument.
 */
export function renderEditorArgv(template: string, target: EditorTarget): string[] {
  const values: Readonly<Record<string, string>> = {
    file: target.file,
    line: String(target.line),
    col: String(target.column),
  };
  const words = splitCommand(template).map((word) =>
    word.replace(/\{(file|line|col)\}/g, (_, name: string) => values[name] ?? ''),
  );
  if (!template.includes('{file}')) words.push(target.file);
  return words;
}
