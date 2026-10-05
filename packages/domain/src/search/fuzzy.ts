export interface FuzzyMatch {
  /** Higher is better. */
  readonly score: number;
  /** Indices of `text` that matched the query, for highlighting. */
  readonly indices: readonly number[];
}

function isWordStart(text: string, index: number): boolean {
  if (index === 0) return true;
  const previous = text[index - 1] ?? '';
  const current = text[index] ?? '';
  return (
    /[\s\-_.:/]/.test(previous) ||
    (previous === previous.toLowerCase() && current !== current.toLowerCase())
  );
}

/**
 * Case-insensitive subsequence match. Matches at word starts and runs of consecutive
 * characters score higher, gaps and late starts score lower. Empty queries match everything.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | undefined {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return { score: 0, indices: [] };
  const haystack = text.toLowerCase();
  const indices: number[] = [];
  let score = 0;
  let from = 0;
  let previous = -2;
  for (const char of needle) {
    if (char === ' ') continue;
    // Prefer the next word start that matches, otherwise the next occurrence.
    let index = -1;
    for (let i = from; i < haystack.length; i++) {
      if (haystack[i] === char && isWordStart(text, i)) {
        index = i;
        break;
      }
    }
    const plain = haystack.indexOf(char, from);
    if (plain === -1) return undefined;
    if (index === -1 || (plain === previous + 1 && plain < index)) index = plain;
    score += 1;
    if (index === previous + 1) score += 5;
    if (isWordStart(text, index)) score += 8;
    score -= Math.min(5, index - from) * 0.5;
    indices.push(index);
    previous = index;
    from = index + 1;
  }
  score -= (indices[0] ?? 0) * 0.1 + text.length * 0.01;
  return { score, indices };
}

/** Items that match `query`, best first; ties keep their original order. */
export function fuzzyFilter<T>(
  items: readonly T[],
  query: string,
  textOf: (item: T) => string,
): { readonly item: T; readonly match: FuzzyMatch }[] {
  const matches: { item: T; match: FuzzyMatch; order: number }[] = [];
  items.forEach((item, order) => {
    const match = fuzzyMatch(query, textOf(item));
    if (match !== undefined) matches.push({ item, match, order });
  });
  matches.sort((a, b) => b.match.score - a.match.score || a.order - b.order);
  return matches.map(({ item, match }) => ({ item, match }));
}
