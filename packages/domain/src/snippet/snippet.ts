/** A reusable piece of text with `{{name}}` or `{{name:default}}` placeholders. */
export interface Snippet {
  readonly name: string;
  readonly body: string;
  readonly description?: string;
}

export interface SnippetVariable {
  readonly name: string;
  readonly defaultValue: string;
}

const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*(?::([^}]*))?\}\}/g;

/** The snippet's variables in order of first appearance; the first default given wins. */
export function snippetVariables(body: string): SnippetVariable[] {
  const variables = new Map<string, string | undefined>();
  for (const match of body.matchAll(PLACEHOLDER)) {
    const [, name = '', fallback] = match;
    const known = variables.get(name);
    if (!variables.has(name) || (known === undefined && fallback !== undefined)) {
      variables.set(name, fallback);
    }
  }
  return [...variables].map(([name, defaultValue]) => ({ name, defaultValue: defaultValue ?? '' }));
}

/** Fills in placeholders; a variable without a value uses its default (or becomes empty). */
export function renderSnippet(body: string, values: Readonly<Record<string, string>>): string {
  const defaults = new Map(snippetVariables(body).map((v) => [v.name, v.defaultValue]));
  return body.replace(PLACEHOLDER, (_match, name: string) => {
    const value = values[name];
    return value === undefined || value === '' ? (defaults.get(name) ?? '') : value;
  });
}
