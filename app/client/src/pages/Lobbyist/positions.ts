/** One disclosed covered position, from `lobbyist_positions` or recovered from the detail row. */
export interface CoveredPosition {
  text: string;
  /** Quarter ends of the first and last report that disclosed it; null when the source is the detail row. */
  first: string | null;
  last: string | null;
}

function earliest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function latest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/**
 * Gold joins distinct covered positions with ` | `. The filings repeat them,
 * sometimes with and sometimes without a final full stop, so dedupe on the
 * text with trailing punctuation removed, keep the longest spelling and
 * widen the span to cover every report that carried it.
 */
export function dedupePositions(entries: ReadonlyArray<CoveredPosition>): CoveredPosition[] {
  const byKey = new Map<string, CoveredPosition>();
  for (const entry of entries) {
    const text = entry.text.trim();
    if (!text) continue;
    const key = text.replace(/[\s.;,]+$/, '').toLowerCase();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { text, first: entry.first, last: entry.last });
      continue;
    }
    byKey.set(key, {
      text: text.length > existing.text.length ? text : existing.text,
      first: earliest(existing.first, entry.first),
      last: latest(existing.last, entry.last),
    });
  }
  return [...byKey.values()];
}
