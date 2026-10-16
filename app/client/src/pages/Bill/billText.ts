import type { SQLStringMarker } from '@databricks/appkit-ui/js';

/** The filing years in the data; every figure on the bill page covers this span. */
export const PERIOD = '2024 to 2025';

const LONG_DATE = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** `2025-07-04` becomes `July 4, 2025`; anything that is not a date passes through. */
export function longDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return LONG_DATE.format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
}

/** The parameters every bill section query takes. */
export type BillParams = { congress: SQLStringMarker; key: SQLStringMarker };

/** The milestone keys `gold.bill_milestone` uses, in legislative order, and their plain names. */
const MILESTONE_NAMES: ReadonlyArray<readonly [string, string]> = [
  ['introduced', 'Introduced'],
  ['reported', 'Reported by committee'],
  ['passed_house', 'Passed House'],
  ['passed_senate', 'Passed Senate'],
  ['to_president', 'Sent to the President'],
  ['became_law', 'Became law'],
];

/** `passed_house` becomes `Passed House`; a key Gold does not define is shown with its underscores as spaces. */
export function milestoneName(key: string | null | undefined): string {
  const trimmed = (key ?? '').trim();
  const known = MILESTONE_NAMES.find(([k]) => k === trimmed);
  return known ? known[1] : trimmed.replace(/_/g, ' ');
}
