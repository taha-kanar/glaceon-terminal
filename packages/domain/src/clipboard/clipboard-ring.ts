export const CLIPBOARD_RING_SIZE = 10;

/**
 * Adds a copied text to the front of the ring (newest first). Copying something already in
 * the ring moves it to the front; blank text is ignored. Returns the same array when nothing
 * changes.
 */
export function pushClip(
  ring: readonly string[],
  text: string,
  size: number = CLIPBOARD_RING_SIZE,
): readonly string[] {
  if (text.trim() === '' || ring[0] === text) return ring;
  return [text, ...ring.filter((item) => item !== text)].slice(0, size);
}

/** One line preview of a clip: whitespace collapsed, long text cut with an ellipsis. */
export function clipPreview(text: string, length = 80): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat;
}
