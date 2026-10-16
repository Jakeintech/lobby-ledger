/**
 * Pure helpers for the lines the client and firm pages add from the
 * organization, surge, peer rank and filing timing marts. The warehouse
 * sends numbers and booleans as text, so every reader coerces once here.
 */
import { toNumber } from '@/lib/format';
import { MIN_RISE } from '@/pages/Home/surge';
import { toFlag } from '@/pages/RevolvingDoor/rows';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2025-04-21` as `21 Apr 2025`, read from the ISO text so time zones cannot shift the day. Non-dates pass through. */
export function dateLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return iso;
  return `${Number(match[3])} ${MONTHS[month - 1]} ${match[1]}`;
}

/**
 * A percentile rank as `top N%`. Gold's `pct_rank` runs from 0 to 1 with 1
 * for the largest income on the issue, so the top share is the remainder,
 * rounded up to a whole percent and never below 1.
 */
export function topShareText(pctRank: number | string | null | undefined): string {
  return `top ${topShare(pctRank)}%`;
}

/** The whole top share behind {@link topShareText}: 1 for the largest income on the issue, 100 for the smallest. */
export function topShare(pctRank: number | string | null | undefined): number {
  const pct = Math.min(1, Math.max(0, toNumber(pctRank)));
  // Round to a tenth first so 1 - 0.99 reads as 1.0 and not 1.0000000000000009.
  const remainder = Math.round((1 - pct) * 1000) / 10;
  return Math.min(100, Math.max(1, Math.ceil(remainder)));
}

/** One row of `peer_ranks`, as the warehouse sends it. */
export interface RawPeerRow {
  issue_code: string | null;
  income: number | string | null;
  pct_rank: number | string | null;
}

export interface PeerGroup {
  /** `top 1%`, the share every code in the group holds. */
  share: string;
  /** The same share as a whole percent. */
  top: number;
  /** Issue codes in the group, highest income first. */
  codes: string[];
}

/**
 * The peer rank rows grouped by their top share, best share first and each
 * group's codes by income, so a firm on sixty issue codes reads as a few
 * groups rather than sixty phrases. Blank codes are dropped and a code that
 * appears twice keeps its first rank.
 */
export function peerGroups(rows: ReadonlyArray<RawPeerRow>): PeerGroup[] {
  const sorted = [...rows]
    .filter((row) => row.issue_code?.trim())
    .sort((a, b) => toNumber(b.pct_rank) - toNumber(a.pct_rank) || toNumber(b.income) - toNumber(a.income));
  const groups = new Map<string, string[]>();
  const seen = new Set<string>();
  for (const row of sorted) {
    const code = (row.issue_code ?? '').trim();
    if (seen.has(code)) continue;
    seen.add(code);
    const share = topShareText(row.pct_rank);
    const codes = groups.get(share);
    if (codes) codes.push(code);
    else groups.set(share, [code]);
  }
  return [...groups].map(([share, codes]) => ({ share, top: Number(share.replace(/\D/g, '')), codes }));
}

/** True when two names match once trimmed and upper-cased, as Gold groups client rows into organizations by name. */
export function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a ?? '').trim().toUpperCase();
  return left !== '' && left === (b ?? '').trim().toUpperCase();
}

/** One row of `surge_for`, as the warehouse sends it. */
export interface RawSurgeRow {
  period_end_date: string;
  income: number | string | null;
  mean_prior: number | string | null;
  z: number | string | null;
  is_surge: boolean | string | number | null;
}

export interface Surge {
  period_end_date: string;
  income: number;
  mean_prior: number;
  /** Null when fewer than three prior quarters were available. */
  z: number | null;
  is_surge: boolean;
}

/**
 * The newest quarter in the surge rows, coerced, or null when there are
 * none. Gold's flag rests on the z-score alone; here a surge also needs the
 * quarter to be at least half again the prior mean, the rule Home applies,
 * so the mark never calls a near-flat quarter a surge.
 */
export function latestSurge(rows: ReadonlyArray<RawSurgeRow>): Surge | null {
  let latest: RawSurgeRow | null = null;
  for (const row of rows) {
    if (!latest || row.period_end_date.localeCompare(latest.period_end_date) > 0) latest = row;
  }
  if (!latest) return null;
  const z = latest.z === null || latest.z === undefined || latest.z === '' ? null : toNumber(latest.z);
  const income = toNumber(latest.income);
  const meanPrior = toNumber(latest.mean_prior);
  const rose = meanPrior <= 0 ? income > 0 : income >= MIN_RISE * meanPrior;
  return {
    period_end_date: latest.period_end_date,
    income,
    mean_prior: meanPrior,
    z,
    is_surge: toFlag(latest.is_surge) === true && rose,
  };
}

/** One row of `client_organization`: a sibling client row and its firm, with the organization header repeated. */
export interface RawOrganizationRow {
  organization_hk: string;
  organization_name: string;
  client_count: number | string;
  registrant_id: string;
  firm: string;
  rank: number | string;
  is_self: boolean | string | number | null;
}

export interface SiblingFirm {
  registrant_id: string;
  firm: string;
}

/**
 * The firms the organization's other client rows registered with, in Gold's
 * rank order, each once, leaving out any firm the requested client itself
 * registered with.
 */
export function siblingFirms(rows: ReadonlyArray<RawOrganizationRow>): SiblingFirm[] {
  const own = new Set(rows.filter((row) => toFlag(row.is_self) === true).map((row) => String(row.registrant_id)));
  const seen = new Set<string>();
  const firms: SiblingFirm[] = [];
  for (const row of [...rows].sort((a, b) => toNumber(a.rank) - toNumber(b.rank))) {
    const id = String(row.registrant_id);
    if (toFlag(row.is_self) === true || own.has(id) || seen.has(id)) continue;
    seen.add(id);
    firms.push({ registrant_id: id, firm: (row.firm ?? '').trim() || id });
  }
  return firms;
}

/** The weekday columns of `filing_timing_summary`, in week order. */
export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export interface WeekdayCount {
  day: Weekday;
  label: string;
  count: number;
}

/** Filings by the weekday they were posted, Monday to Sunday, from the summary row's seven columns. */
export function weekdayCounts(summary: Record<Weekday, number | string | null | undefined>): WeekdayCount[] {
  return WEEKDAYS.map((day) => ({ day, label: WEEKDAY_LABELS[day], count: toNumber(summary[day]) }));
}

/** `0.00179` as `0.2%`; whole percents above 1, one decimal below, and `0%` for none. */
export function shareText(share: number | string | null | undefined): string {
  const pct = Math.min(100, Math.max(0, toNumber(share) * 100));
  if (pct === 0) return '0%';
  if (pct < 1) return `${Math.max(0.1, Math.round(pct * 10) / 10)}%`;
  return `${Math.round(pct)}%`;
}

/** `0 days`, `1 day`, `17 days`. */
export function daysText(days: number | string | null | undefined): string {
  const n = Math.round(toNumber(days));
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}
