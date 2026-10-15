import { toNumber } from '@/lib/format';
import { toConfidence } from '@/pages/Lobbyist/affiliation';
import type { Confidence } from '@/pages/Lobbyist/affiliation';

/**
 * One row of the revolving door list as either query delivers it. The
 * warehouse sends numbers and booleans as text, and only the fallback query
 * carries a confidence column, so both are optional and loosely typed here.
 */
export interface RawRevolvingDoorRow {
  lobbyist_id: string;
  engagement_hk: string;
  full_name: string;
  kind: string;
  ref_name: string;
  client_id: string;
  client: string;
  registrant_id: string;
  firm: string;
  issue_codes: string | null;
  income: number | string | null;
  lobbies_former_employer?: boolean | string | number | null;
  confidence?: string | null;
}

/** The same row with every value coerced once, so the table never re-parses. */
export interface RevolvingDoorRow {
  lobbyist_id: string;
  engagement_hk: string;
  full_name: string;
  kind: string;
  ref_name: string;
  client_id: string;
  client: string;
  registrant_id: string;
  firm: string;
  issue_codes: string | null;
  income: number;
  /** Null when the query carries no flag column. */
  lobbies_former_employer: boolean | null;
  /** Null when the query carries no confidence column or the match has none. */
  confidence: Confidence | null;
}

/** Reads a warehouse boolean, which arrives as `true`, `'true'`, `1` or `'1'`; null when the column is absent. */
export function toFlag(value: boolean | string | number | null | undefined): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (text === 'true' || text === '1') return true;
  if (text === 'false' || text === '0') return false;
  return null;
}

export function normalizeRows(rows: ReadonlyArray<RawRevolvingDoorRow>): RevolvingDoorRow[] {
  return rows.map((row) => ({
    lobbyist_id: String(row.lobbyist_id),
    engagement_hk: String(row.engagement_hk),
    full_name: (row.full_name ?? '').trim(),
    kind: (row.kind ?? '').trim(),
    ref_name: (row.ref_name ?? '').trim(),
    client_id: String(row.client_id),
    client: (row.client ?? '').trim(),
    registrant_id: String(row.registrant_id),
    firm: (row.firm ?? '').trim(),
    issue_codes: row.issue_codes ?? null,
    income: toNumber(row.income),
    lobbies_former_employer: toFlag(row.lobbies_former_employer),
    confidence: toConfidence(row.confidence),
  }));
}

/** `EDU, TAX` becomes `['EDU', 'TAX']`, deduplicated. */
export function splitCodes(codes: string | null | undefined): string[] {
  return [
    ...new Set(
      (codes ?? '')
        .split(',')
        .map((code) => code.trim())
        .filter(Boolean)
    ),
  ];
}

export interface RevolvingDoorSummary {
  lobbyists: number;
  engagements: number;
  /** Reported income summed once per engagement, since one lobbyist can appear on several rows. */
  income: number;
  /** Lobbyists with at least one row flagged as lobbying a former employer. */
  lobbyingFormerEmployer: number;
}

export function summarize(rows: ReadonlyArray<RevolvingDoorRow>): RevolvingDoorSummary {
  const lobbyists = new Set<string>();
  const flagged = new Set<string>();
  const incomeByEngagement = new Map<string, number>();
  for (const row of rows) {
    lobbyists.add(row.lobbyist_id);
    if (row.lobbies_former_employer) flagged.add(row.lobbyist_id);
    if (!incomeByEngagement.has(row.engagement_hk)) incomeByEngagement.set(row.engagement_hk, row.income);
  }
  let income = 0;
  for (const value of incomeByEngagement.values()) income += value;
  return {
    lobbyists: lobbyists.size,
    engagements: incomeByEngagement.size,
    income,
    lobbyingFormerEmployer: flagged.size,
  };
}
