import { extname, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BACKGROUND_IMAGE_SCHEME } from '@glaceon/contracts';
import { net, protocol } from 'electron';

/** Formats Chromium can paint, for the open dialog and the protocol handler. */
export const BACKGROUND_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp'];

/** The configured image as an absolute path, or undefined when unset or not an image. */
export function resolveBackgroundImage(setting: string, home: string): string | undefined {
  const trimmed = setting.trim();
  if (trimmed === '') return undefined;
  const path = trimmed === '~' || trimmed.startsWith('~/') ? join(home, trimmed.slice(1)) : trimmed;
  if (!isAbsolute(path)) return undefined;
  const extension = extname(path).slice(1).toLowerCase();
  return BACKGROUND_IMAGE_EXTENSIONS.includes(extension) ? path : undefined;
}

/** Must run before the app is ready. */
export function registerBackgroundImageScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: BACKGROUND_IMAGE_SCHEME, privileges: { standard: true, secure: true } },
  ]);
}

/**
 * Serves the configured background image, whatever the requested path: renderers can never
 * read another file through this scheme.
 */
export function serveBackgroundImage(current: () => string | undefined): void {
  protocol.handle(BACKGROUND_IMAGE_SCHEME, async () => {
    const path = current();
    if (path === undefined) return new Response(null, { status: 404 });
    try {
      const file = await net.fetch(pathToFileURL(path).href);
      // Not cached: the same path may hold a new picture, or stop being the configured one.
      const headers = new Headers(file.headers);
      headers.set('cache-control', 'no-store');
      return new Response(file.body, { status: file.status, headers });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
}
