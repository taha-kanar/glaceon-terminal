import type { ClipboardPort } from '@glaceon/application';
import { clipboard } from 'electron';

export class SystemClipboard implements ClipboardPort {
  readText(): Promise<string> {
    return clipboard.readText();
  }

  writeText(text: string): Promise<void> {
    return clipboard.writeText(text);
  }
}

/** Used under e2e tests, so test runs never read or overwrite the user's clipboard. */
export class MemoryClipboard implements ClipboardPort {
  #text = '';

  readText(): Promise<string> {
    return Promise.resolve(this.#text);
  }

  writeText(text: string): Promise<void> {
    this.#text = text;
    return Promise.resolve();
  }
}
