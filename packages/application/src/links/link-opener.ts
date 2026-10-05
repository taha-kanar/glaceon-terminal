import type { Result } from '@glaceon/domain';

export interface FileLinkRequest {
  /** As printed in the terminal; may be relative or start with `~`. */
  readonly path: string;
  /** Working directory of the shell the path was printed in. */
  readonly cwd?: string;
  readonly line?: number;
  readonly column?: number;
}

/** Opens links outside the terminal (browser, editor, Finder). */
export interface LinkOpener {
  openUrl(url: string): Promise<Result<void, string>>;
  openFile(request: FileLinkRequest): Promise<Result<void, string>>;
}
