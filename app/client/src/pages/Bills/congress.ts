import { billsPath } from '@/lib/routes';

/** The Congresses the data slice covers: filings from 2024 fall in the 118th, from 2025 in the 119th. */
export const CONGRESSES: ReadonlyArray<{ congress: number; filingYear: number }> = [
  { congress: 119, filingYear: 2025 },
  { congress: 118, filingYear: 2024 },
];

export const DEFAULT_CONGRESS = 119;

/** `119` becomes `119th`. */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  const suffix = rem100 >= 11 && rem100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

/** Reads a Congress number from the query string; anything outside the slice falls back to the default. */
export function parseCongress(value: string | null): number {
  const n = Number(value);
  return CONGRESSES.some((c) => c.congress === n) ? n : DEFAULT_CONGRESS;
}

/** Reads a Congress number from a route segment; null for anything outside the slice, so the caller can look it up. */
export function congressFromParam(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const n = Number(value);
  return CONGRESSES.some((c) => c.congress === n) ? n : null;
}

/** The filing year whose reports fall in a Congress, or null when the Congress is outside the slice. */
export function filingYearOf(congress: number): number | null {
  return CONGRESSES.find((c) => c.congress === congress)?.filingYear ?? null;
}

/** The bills list for one Congress; the default Congress needs no query string. */
export function billsCongressPath(congress: number): string {
  return congress === DEFAULT_CONGRESS
    ? billsPath()
    : `${billsPath()}?congress=${encodeURIComponent(String(congress))}`;
}
