import { toNumber } from '@/lib/format';
import type { EntityKind } from '@/components/EntityLink';

/** One row of `surges` as the warehouse sends it: numbers may arrive as text. */
export interface RawSurgeRow {
  kind: string;
  id: string;
  name: string;
  period_end_date: string;
  income: number | string | null;
  mean_prior: number | string | null;
  z: number | string | null;
}

/**
 * A surge needs both: Gold's z of at least 2 over the prior quarters, and a
 * quarter at least half again the prior mean. The second rule keeps out a
 * quarter that passes the first only because its earlier quarters were
 * near-identical, so the spread was close to nothing. The `surges` query
 * applies the same ratio so its cap is not spent on flat rows.
 */
export const MIN_RISE = 1.5;

/** `gold.surge.kind` values as the SQL spells them. */
export type SurgeKind = 'client' | 'firm' | 'issue';

export interface Surge {
  kind: SurgeKind;
  id: string;
  name: string;
  period_end_date: string;
  income: number;
  meanPrior: number;
  z: number;
}

function toKind(kind: string): SurgeKind {
  const text = kind.trim().toLowerCase();
  return text === 'firm' || text === 'issue' ? text : 'client';
}

/** The entity page a surge links to: issues have topic pages, the rest their own. */
export function surgeLinkKind(kind: SurgeKind): Extract<EntityKind, 'client' | 'firm' | 'topic'> {
  return kind === 'issue' ? 'topic' : kind;
}

/** `Client`, `Firm` or `Issue area`, for the label beside the name. */
export function surgeKindLabel(kind: SurgeKind): string {
  return kind === 'issue' ? 'Issue area' : kind === 'firm' ? 'Firm' : 'Client';
}

/**
 * The surges in the most recent quarter the rows cover, highest z first.
 * Gold flags a surge in any quarter with at least three earlier ones, so
 * the query's rows span several quarters; Home shows only the latest, and
 * only those that rose by {@link MIN_RISE} over the prior mean.
 */
export function latestQuarterSurges(rows: ReadonlyArray<RawSurgeRow>): Surge[] {
  const surges = rows
    .filter((row) => /^\d{4}-\d{2}-\d{2}/.test(row.period_end_date ?? ''))
    .map<Surge>((row) => ({
      kind: toKind(row.kind),
      id: String(row.id),
      name: (row.name ?? '').trim() || String(row.id),
      period_end_date: row.period_end_date.slice(0, 10),
      income: toNumber(row.income),
      meanPrior: toNumber(row.mean_prior),
      z: toNumber(row.z),
    }))
    .filter((row) => (row.meanPrior <= 0 ? row.income > 0 : row.income / row.meanPrior >= MIN_RISE));
  if (surges.length === 0) return [];
  const latest = surges.reduce((best, row) => (row.period_end_date > best ? row.period_end_date : best), '');
  return surges
    .filter((row) => row.period_end_date === latest)
    .sort((a, b) => b.z - a.z || b.income - a.income || a.name.localeCompare(b.name));
}

/**
 * The quarter's income against the mean of the earlier quarters, in plain
 * words: `55 times its usual quarter`. Under ten the ratio keeps one decimal;
 * a ratio within a twentieth of one says so rather than printing `1.0 times`,
 * because a surge can rest on a tiny spread between near-identical quarters.
 */
export function timesUsualText(income: number, meanPrior: number): string {
  if (meanPrior <= 0)
    return income > 0 ? 'up from nothing in its earlier quarters' : 'no change on its earlier quarters';
  const ratio = income / meanPrior;
  if (ratio < 1.05) return 'about the same as its usual quarter';
  if (ratio >= 10) return `${Math.round(ratio)} times its usual quarter`;
  return `${ratio.toFixed(1)} times its usual quarter`;
}
