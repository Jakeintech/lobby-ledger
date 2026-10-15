/**
 * Formatting helpers shared by every page.
 *
 * Bill keys are stored in Gold as a compact uppercase token such as `HR1`
 * or `SJRES5`. Labels are the Congress house style, `H.R. 1` or `S.J.Res. 5`.
 */

/** Bill types in the order the LDA data uses them, longest prefix first so `HRES` wins over `HR`. */
const BILL_TYPES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'HCONRES', label: 'H.Con.Res.' },
  { key: 'SCONRES', label: 'S.Con.Res.' },
  { key: 'HJRES', label: 'H.J.Res.' },
  { key: 'SJRES', label: 'S.J.Res.' },
  { key: 'HRES', label: 'H.Res.' },
  { key: 'SRES', label: 'S.Res.' },
  { key: 'HR', label: 'H.R.' },
  { key: 'S', label: 'S.' },
];

const BILL_KEY_PATTERN = /^(HCONRES|SCONRES|HJRES|SJRES|HRES|SRES|HR|S)0*([1-9][0-9]{0,4})$/;

/**
 * Normalizes user input such as `h.r. 1`, `HR 1` or `S. 1477` to the Gold
 * bill key (`HR1`, `S1477`). Returns null when the input is not a bill number.
 */
export function normalizeBillKey(input: string): string | null {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = BILL_KEY_PATTERN.exec(compact);
  if (!match) return null;
  return `${match[1]}${match[2]}`;
}

/** Turns a Gold bill key into its display label: `HR1` becomes `H.R. 1`. Unknown keys pass through. */
export function billLabel(key: string): string {
  const match = BILL_KEY_PATTERN.exec(key);
  if (!match) return key;
  const type = BILL_TYPES.find((t) => t.key === match[1]);
  if (!type) return key;
  return `${type.label} ${match[2]}`;
}

/**
 * Labels a quarter end date (`2024-03-31`) as `Q1 2024`. Reads the year and
 * month from the ISO text so time zones cannot shift the date. Non-dates
 * are returned unchanged.
 */
export function quarterLabel(periodEnd: string | Date): string {
  const iso = periodEnd instanceof Date ? periodEnd.toISOString() : periodEnd;
  const match = /^(\d{4})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return iso;
  const quarter = Math.ceil(month / 3);
  return `Q${quarter} ${match[1]}`;
}

export interface MoneyOptions {
  /** Shorten to `$1.2M` style; the default writes every digit. */
  compact?: boolean;
}

const WHOLE_DOLLARS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const COMPACT_DOLLARS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Coerces a warehouse value (number, decimal string, null) to a finite number, treating junk as 0. */
export function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Formats reported income in U.S. dollars. Null income counts as $0, as the LDA allows. */
export function money(value: number | string | null | undefined, options: MoneyOptions = {}): string {
  const amount = toNumber(value);
  return options.compact ? COMPACT_DOLLARS.format(amount) : WHOLE_DOLLARS.format(amount);
}

/** Formats a count with thousands separators. */
export function count(value: number | string | null | undefined): string {
  return new Intl.NumberFormat('en-US').format(toNumber(value));
}
