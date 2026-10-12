export const CLIPBOARD_RING_SIZE = 10;

/**
 * Longest text the ring keeps, in UTF-16 code units. Every window holds a copy of the ring, so
 * a huge copy (a whole log) stays on the system clipboard only.
 */
export const MAX_RING_CLIP_LENGTH = 1024 * 1024;

/**
 * Adds a copied text to the front of the ring (newest first). Copying something already in
 * the ring moves it to the front; blank and oversized text is ignored. Returns the same array
 * when nothing changes.
 */
export function pushClip(
  ring: readonly string[],
  text: string,
  size: number = CLIPBOARD_RING_SIZE,
): readonly string[] {
  if (text.length > MAX_RING_CLIP_LENGTH || text.trim() === '' || ring[0] === text) return ring;
  return [text, ...ring.filter((item) => item !== text)].slice(0, size);
}

/** One line preview of a clip: whitespace collapsed, long text cut with an ellipsis. */
export function clipPreview(text: string, length = 80): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat;
}
