/**
 * Quarter arithmetic and small chart helpers shared by the ledger chart, the
 * sparklines, the engagement table and the heatmap. All date work reads the
 * year, month and day from the ISO text so time zones cannot move a quarter.
 */

/** The eight quarter ends the data covers, in order. */
export const QUARTER_ENDS: ReadonlyArray<string> = [
  '2024-03-31',
  '2024-06-30',
  '2024-09-30',
  '2024-12-31',
  '2025-03-31',
  '2025-06-30',
  '2025-09-30',
  '2025-12-31',
];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

function parts(iso: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!iso) return null;
  const match = ISO_DATE.exec(iso);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year: Number(match[1]), month, day };
}

/** Quarters since the year 0, so quarters from different years compare and subtract. */
export function quarterOrdinal(iso: string | null | undefined): number | null {
  const p = parts(iso);
  if (!p) return null;
  return p.year * 4 + Math.ceil(p.month / 3) - 1;
}

/** Position of a date's quarter in {@link QUARTER_ENDS}, or null when outside 2024 to 2025. */
export function quarterIndex(iso: string | null | undefined): number | null {
  const ordinal = quarterOrdinal(iso);
  const first = quarterOrdinal(QUARTER_ENDS[0]);
  if (ordinal === null || first === null) return null;
  const index = ordinal - first;
  return index >= 0 && index < QUARTER_ENDS.length ? index : null;
}

/** The quarter end date (`2024-06-30`) of the quarter a date falls in. */
export function quarterEndOf(iso: string | null | undefined): string | null {
  const p = parts(iso);
  if (!p) return null;
  const endMonth = Math.ceil(p.month / 3) * 3;
  const lastDay = new Date(Date.UTC(p.year, endMonth, 0)).getUTCDate();
  return `${p.year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

/** How far through its quarter a date is, from 0 at the first day to 1 at the last. */
export function quarterFraction(iso: string | null | undefined): number | null {
  const p = parts(iso);
  if (!p) return null;
  const startMonth = (Math.ceil(p.month / 3) - 1) * 3;
  const start = Date.UTC(p.year, startMonth, 1);
  const end = Date.UTC(p.year, startMonth + 3, 0);
  const day = Date.UTC(p.year, p.month - 1, p.day);
  const length = end - start;
  if (length <= 0) return 0;
  return Math.min(1, Math.max(0, (day - start) / length));
}

/** True when the quarter of `date` lies within the span `first` to `last`, inclusive. */
export function spanIncludes(first: string | null, last: string | null, date: string): boolean {
  const a = quarterOrdinal(first);
  const b = quarterOrdinal(last);
  const q = quarterOrdinal(date);
  if (a === null || b === null || q === null) return false;
  return q >= Math.min(a, b) && q <= Math.max(a, b);
}

/**
 * A value-axis ceiling with round ticks: the smallest 1, 2, 2.5 or 5 multiple
 * of a power of ten whose `ticks` steps clear `max` with a little headroom.
 */
export function niceScale(max: number, ticks = 4): { max: number; interval: number } {
  if (!Number.isFinite(max) || max <= 0) return { max: ticks, interval: 1 };
  const rawStep = (max * 1.08) / ticks;
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * power);
  const interval = candidates.find((step) => step * ticks >= max * 1.04) ?? candidates[candidates.length - 1];
  return { max: interval * ticks, interval };
}

/** Escapes text for an HTML string, as ECharts tooltip formatters return markup. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** `Q1 2024 to Q4 2025`, or the single quarter when both ends match, or null when either is missing. */
export function spanText(first: string | null, last: string | null, label: (iso: string) => string): string | null {
  if (!first || !last) return null;
  const from = label(first);
  const to = label(last);
  return from === to ? from : `${from} to ${to}`;
}

/** Reads the OS reduced motion preference. False outside a browser. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
