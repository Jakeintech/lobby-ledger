import { useMemo } from 'react';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { PageState } from '@/components/PageState';
import { count, money, toNumber } from '@/lib/format';
import { longDate, milestoneName } from '@/pages/Bill/billText';
import type { BillParams } from '@/pages/Bill/billText';

export interface MilestoneWindowsProps {
  label: string;
  params: BillParams;
  onRetry: () => void;
}

/** One milestone with the lobbying Gold counted in the 90 days before it. */
interface MilestoneWindow {
  key: string;
  name: string;
  date: string | null;
  filings: number;
  income: number;
  clients: number;
}

function plural(n: number, noun: string): string {
  return `${count(n)} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * The quarterly reports, reported income and distinct clients that named
 * the bill in the 90 days before each legislative milestone, one line per
 * milestone in date order. Gold holds no milestones until the Congress.gov
 * actions are loaded, so an empty result is explained in a sentence rather
 * than shown as a missing section.
 */
export function MilestoneWindows({ label, params, onRetry }: MilestoneWindowsProps) {
  const { data, loading, error } = useAnalyticsQuery('bill_milestone_windows', params);
  const rows = useMemo<MilestoneWindow[]>(
    () =>
      (data ?? [])
        .filter((row) => row.milestone?.trim())
        .map((row) => ({
          key: `${row.milestone}/${row.milestone_date ?? ''}`,
          name: milestoneName(row.milestone),
          date: longDate(row.milestone_date),
          filings: toNumber(row.filings_90d_before),
          income: toNumber(row.income_90d_before),
          clients: toNumber(row.clients_90d_before),
        })),
    [data]
  );

  return (
    <figure className="min-w-0">
      <figcaption className="border-t border-border pt-3">
        <p className="font-medium text-foreground">Lobbying before each milestone</p>
        <p className="text-sm text-muted-foreground">
          Quarterly reports naming {label} whose quarter ended in the 90 days before each legislative step, with the
          income those filings reported across every issue and the clients they were filed for. Milestones come from
          Congress.gov.
        </p>
      </figcaption>
      <PageState loading={loading} error={error} empty={false} emptyMessage="" onRetry={onRetry}>
        {rows.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Milestones appear once Congress.gov data is loaded for this bill.
          </p>
        ) : (
          <ol className="mt-3 divide-y divide-border">
            {rows.map((row) => (
              <li
                key={row.key}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2 text-sm first:pt-0"
              >
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="font-medium text-foreground">{row.name}</span>
                  {row.date && <span className="text-muted-foreground">{row.date}</span>}
                </span>
                <span className="shrink-0 tabular-nums text-foreground">
                  {plural(row.filings, 'filing')}, {money(row.income)}, {plural(row.clients, 'client')}
                  <span className="text-muted-foreground"> in the 90 days before</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </PageState>
    </figure>
  );
}
