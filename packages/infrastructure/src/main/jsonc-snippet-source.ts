import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { SnippetSource } from '@glaceon/application';
import { err, ok, type Disposable, type Result, type Snippet } from '@glaceon/domain';
import { parse, printParseErrorCode, stripComments, type ParseError } from 'jsonc-parser';
import { z } from 'zod';
import { contentHash, watchFileContent } from './file-watch';

const snippetSchema = z.array(
  z.object({
    name: z.string().trim().min(1),
    body: z.string(),
    description: z.string().optional(),
  }),
);

export const SNIPPETS_TEMPLATE = `// Glaceon snippets (⌘⇧S). Placeholders: {{name}} or {{name:default}}.
// Every placeholder is asked for in one form before the snippet is pasted.
[
  {
    "name": "Find files by name",
    "body": "find {{dir:.}} -name '{{pattern:*.ts}}'",
    "description": "Search a directory tree"
  },
  {
    "name": "Git commit",
    "body": "git commit -m \\"{{message}}\\""
  }
]
`;

export function parseSnippetsText(text: string): Result<readonly Snippet[], string> {
  if (stripComments(text).trim() === '') return ok([]);
  const errors: ParseError[] = [];
  const value: unknown = parse(text, errors, { allowTrailingComma: true });
  const first = errors[0];
  if (first !== undefined) {
    const line = text.slice(0, first.offset).split('\n').length;
    return err(`snippets.json: ${printParseErrorCode(first.error)} at line ${String(line)}`);
  }
  const parsed = snippetSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return err(`snippets.json: ${issue?.path.join('.') ?? ''} ${issue?.message ?? 'is invalid'}`);
  }
  return ok(
    parsed.data.map(({ name, body, description }) =>
      description === undefined ? { name, body } : { name, body, description },
    ),
  );
}

/** Snippets in a JSONC file next to config.json, reloaded when it changes. */
export class JsoncSnippetSource implements SnippetSource {
  readonly #path: string;
  #lastHash: string | undefined;

  constructor(path: string) {
    this.#path = path;
  }

  get path(): string {
    return this.#path;
  }

  async ensureExists(): Promise<void> {
    await mkdir(dirname(this.#path), { recursive: true });
    try {
      await writeFile(this.#path, SNIPPETS_TEMPLATE, { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }

  async read(): Promise<Result<readonly Snippet[], string>> {
    let text: string;
    try {
      text = await readFile(this.#path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ok([]);
      return err(`Cannot read ${this.#path}: ${(error as Error).message}`);
    }
    this.#lastHash = contentHash(text);
    return parseSnippetsText(text);
  }

  watch(onChange: () => void): Disposable {
    return watchFileContent(this.#path, {
      debounceMs: 100,
      lastHash: () => this.#lastHash,
      onChange,
    });
  }
}
