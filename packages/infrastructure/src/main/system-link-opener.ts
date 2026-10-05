import { stat } from 'node:fs/promises';
import type { FileLinkRequest, LinkOpener } from '@glaceon/application';
import { err, ok, renderEditorArgv, resolveLinkPath, type Result } from '@glaceon/domain';
import type { EditorLauncher } from './editor-launcher';

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export interface SystemLinkOpenerDeps {
  readonly home: string;
  readonly editorCommand: () => string;
  readonly editor: EditorLauncher;
  readonly openExternal: (url: string) => Promise<void>;
  /** Opens a path with its default app (Finder for directories); resolves to an error message or ''. */
  readonly openPath: (path: string) => Promise<string>;
}

/** Opens links from terminals: web links in the browser, files in the editor, folders in Finder. */
export class SystemLinkOpener implements LinkOpener {
  readonly #deps: SystemLinkOpenerDeps;

  constructor(deps: SystemLinkOpenerDeps) {
    this.#deps = deps;
  }

  async openUrl(url: string): Promise<Result<void, string>> {
    let protocol: string;
    try {
      protocol = new URL(url).protocol;
    } catch {
      return err(`Not a valid link: ${url}`);
    }
    if (!SAFE_PROTOCOLS.has(protocol)) return err(`Links of type ${protocol} are not opened`);
    try {
      await this.#deps.openExternal(url);
      return ok(undefined);
    } catch (error) {
      return err(`Cannot open ${url}: ${(error as Error).message}`);
    }
  }

  async openFile(request: FileLinkRequest): Promise<Result<void, string>> {
    const path = resolveLinkPath(request.path, { cwd: request.cwd, home: this.#deps.home });
    let isDirectory: boolean;
    try {
      isDirectory = (await stat(path)).isDirectory();
    } catch {
      return err(`${path} does not exist`);
    }
    if (isDirectory) {
      const message = await this.#deps.openPath(path);
      return message === '' ? ok(undefined) : err(message);
    }
    const argv = renderEditorArgv(this.#deps.editorCommand(), {
      file: path,
      line: request.line ?? 1,
      column: request.column ?? 1,
    });
    return this.#deps.editor.launch(argv);
  }
}
