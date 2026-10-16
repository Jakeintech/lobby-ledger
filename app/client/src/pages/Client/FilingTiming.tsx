import { useMemo } from 'react';
import { sql } from '@databricks/appkit-ui/js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@databricks/appkit-ui/react';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { PageState } from '@/components/PageState';
import { StatTiles } from '@/components/StatTiles';
import type { StatTile } from '@/components/StatTiles';
import { count, quarterLabel, toNumber } from '@/lib/format';
import { toFlag } from '@/pages/RevolvingDoor/rows';
import { dateLabel, daysText, shareText, weekdayCounts } from '@/pages/Client/signals';
import type { WeekdayCount } from '@/pages/Client/signals';

export interface FilingTimingProps {
  kind: 'client' | 'firm';
  id: string;
  /** The entity's name, for the title and the empty state. */
  name: string;
  onRetry: () => void;
}

const BAR_HEIGHT = 44;

/** A small amber square, the mark the app uses for events, set before a late figure. */
function LateMark() {
  return (
    <span
      aria-hidden="true"
      className="mr-1.5 inline-block size-1.5 rounded-[1px] align-middle"
      style={{ backgroundColor: 'var(--event)' }}
    />
  );
}

/** Seven small columns, Monday to Sunday, scaled to the busiest weekday. */
function WeekdayBars({ counts }: { counts: WeekdayCount[] }) {
  const max = Math.max(0, ...counts.map((c) => c.count));
  const summary = counts.map((c) => `${c.label} ${count(c.count)}`).join(', ');
  return (
    <div className="min-w-0">
      <p className="text-sm text-muted-foreground">Filings by the weekday they were posted</p>
      <div
        role="img"
        aria-label={`Filings by weekday posted: ${summary}.`}
        className="mt-2 grid max-w-md grid-cols-7 items-end gap-2"
      >
        {counts.map((c) => {
          const height = max > 0 && c.count > 0 ? Math.max(2, Math.round((c.count / max) * BAR_HEIGHT)) : 0;
          return (
            <div key={c.day} className="flex min-w-0 flex-col items-center gap-1" aria-hidden="true">
              <span className="text-xs tabular-nums text-muted-foreground">{count(c.count)}</span>
              <span className="flex w-full items-end justify-center" style={{ height: BAR_HEIGHT }}>
                <span
                  className="block w-full max-w-8 rounded-sm"
                  style={{ height, backgroundColor: 'var(--ledger)' }}
                />
              </span>
              <span className="text-xs text-muted-foreground">{c.label.slice(0, 3)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * When the entity's quarterly reports were posted against the LDA deadline:
 * the share posted late and the median days late as figures, filings by
 * weekday as a small bar, and every quarter with its due date, posted date
 * and days late. A firm files one report per client, so for it a quarter
 * shows the span of posted dates, how many filings were late and the longest
 * delay, never one straggler's figure for the whole. The firm page shares it.
 */
export function FilingTiming({ kind, id, name, onRetry }: FilingTimingProps) {
  const params = useMemo(() => ({ kind: sql.string(kind), id: sql.string(id) }), [kind, id]);
  const summary = useAnalyticsQuery('filing_timing_summary', params);
  const periods = useAnalyticsQuery('filing_timing_for', params);

  const total = summary.data?.[0];
  const filings = toNumber(total?.filing_count);
  const rows = useMemo(
    () => [...(periods.data ?? [])].sort((a, b) => a.period_end_date.localeCompare(b.period_end_date)),
    [periods.data]
  );
  const counts = useMemo(() => (total ? weekdayCounts(total) : []), [total]);
  const multiple = rows.some((row) => toNumber(row.filing_count) > 1);

  const tiles = useMemo<StatTile[]>(() => {
    if (!total) return [];
    const late = toNumber(total.late_count);
    return [
      {
        id: 'late',
        label: 'Posted after the deadline',
        value: shareText(total.late_share),
        hint: `${count(late)} of ${count(filings)} ${filings === 1 ? 'filing' : 'filings'}`,
      },
      {
        id: 'median',
        label: 'Median days late',
        value: count(Math.round(toNumber(total.median_days_late))),
        hint: late > 0 ? `the longest delay was ${daysText(total.max_days_late)}` : 'none posted late',
      },
      {
        id: 'filings',
        label: 'Filings',
        value: count(filings),
        hint: 'quarterly reports with a posted date',
      },
    ];
  }, [total, filings]);

  const subject = kind === 'firm' ? `filed by ${name}` : `for ${name}`;

  return (
    <figure className="min-w-0">
      <figcaption className="border-t border-border pt-3">
        <p className="font-medium text-foreground">When the quarterly reports {subject} were posted</p>
        <p className="text-sm text-muted-foreground">
          A quarterly report is due 20 days after the quarter ends, or the next weekday when that falls on a weekend.
          Days late count from that observed deadline, 2024 to 2025.
          {multiple
            ? ' For a quarter with several filings, the row shows how many were late and the longest delay.'
            : ''}
        </p>
      </figcaption>
      <div className="mt-4">
        <PageState
          loading={summary.loading || periods.loading}
          error={summary.error ?? periods.error}
          empty={filings === 0 || rows.length === 0}
          emptyTitle="No posted dates"
          emptyMessage={`No quarterly report ${subject} carries a posted date, so timing cannot be measured.`}
          onRetry={onRetry}
        >
          <div className="space-y-6">
            <StatTiles tiles={tiles} columns={3} />
            <WeekdayBars counts={counts} />
            <div className="w-full overflow-x-auto border-t border-border">
              <Table>
                <caption className="sr-only">
                  {count(rows.length)} quarters, with the due date, the posted date and the days late for each.
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quarter</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Posted</TableHead>
                    <TableHead className="text-right">Days late</TableHead>
                    {multiple && <TableHead className="text-right">Filings</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const late = toFlag(row.late) === true && toNumber(row.late_count) > 0;
                    const first = dateLabel(row.first_posted_date);
                    const last = dateLabel(row.last_posted_date);
                    const several = toNumber(row.filing_count) > 1;
                    return (
                      <TableRow key={row.period_end_date}>
                        <TableCell className="align-top whitespace-nowrap">
                          {quarterLabel(row.period_end_date)}
                        </TableCell>
                        <TableCell className="align-top whitespace-nowrap">
                          {dateLabel(row.due_date_observed || row.due_date)}
                        </TableCell>
                        <TableCell className="align-top whitespace-nowrap">
                          {several && first !== last ? `${first} to ${last}` : first}
                        </TableCell>
                        <TableCell className="text-right align-top whitespace-nowrap tabular-nums">
                          {late ? (
                            <span className="font-medium text-foreground">
                              <LateMark />
                              {several
                                ? `${count(row.late_count)} of ${count(row.filing_count)} late, up to ${daysText(row.max_days_late)}`
                                : daysText(row.max_days_late)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">On time</span>
                          )}
                        </TableCell>
                        {multiple && (
                          <TableCell className="text-right align-top whitespace-nowrap tabular-nums">
                            {count(row.filing_count)}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </PageState>
      </div>
    </figure>
  );
}
