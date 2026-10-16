import { useMemo } from 'react';
import { Skeleton, useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { EntityLink } from '@/components/EntityLink';
import { PageState } from '@/components/PageState';
import { money, quarterLabel } from '@/lib/format';
import { latestQuarterSurges, surgeKindLabel, surgeLinkKind, timesUsualText } from '@/pages/Home/surge';

/** `surges` takes no parameters; one shared object keeps the hook's cache key stable. */
const NO_PARAMS: Record<string, never> = {};

/** How many surges the row lists. The query is already capped at forty across every quarter. */
const MAX_ROWS = 10;

function RowSkeleton() {
  return (
    <div className="space-y-3 border-t border-border pt-3" aria-busy="true" aria-live="polite">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

/** The amber mark that every event and surge in the app carries. */
function SurgeMark() {
  return (
    <span
      aria-hidden="true"
      className="mt-2 inline-block size-2 shrink-0 rounded-sm"
      style={{ backgroundColor: 'var(--event)' }}
    />
  );
}

export interface SurgeRowProps {
  onRetry: () => void;
}

/**
 * Clients, firms and issue areas whose latest quarter stands well above
 * their earlier ones: Gold flags a surge when the quarter's income is two or
 * more standard deviations over the mean of at least three prior quarters,
 * and the row also asks for at least half again that mean. One line each,
 * with the quarter's income and the rise in plain words. The section
 * heading on Home names the row, so the caption is the one sentence.
 */
export function SurgeRow({ onRetry }: SurgeRowProps) {
  const { data, loading, error } = useAnalyticsQuery('surges', NO_PARAMS);
  const rows = useMemo(() => latestQuarterSurges(data ?? []).slice(0, MAX_ROWS), [data]);
  const quarter = rows[0]?.period_end_date;

  return (
    <PageState
      loading={loading}
      error={error}
      empty={false}
      emptyMessage=""
      onRetry={onRetry}
      skeleton={<RowSkeleton />}
    >
      <figure className="min-w-0">
        <figcaption className="border-t border-border pt-3">
          <p className="text-sm text-muted-foreground">
            Clients, firms and issue areas whose {quarter ? quarterLabel(quarter) : 'latest quarter'} income is at least
            two standard deviations above, and at least half again, the mean of their earlier quarters, highest first.
          </p>
        </figcaption>
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No client, firm or issue area reported a quarter far enough above its earlier ones to count as a surge.
          </p>
        ) : (
          <ol className="mt-2 divide-y divide-border">
            {rows.map((row) => (
              <li
                key={`${row.kind}:${row.id}`}
                className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 py-2 text-sm"
              >
                <span className="flex min-w-0 flex-1 items-start gap-2">
                  <SurgeMark />
                  <span className="min-w-0">
                    <span className="block text-xs text-muted-foreground">{surgeKindLabel(row.kind)}</span>
                    <EntityLink kind={surgeLinkKind(row.kind)} id={row.id} name={row.name} />
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end text-right">
                  <span className="tabular-nums text-foreground">{money(row.income)}</span>
                  <span className="text-xs text-muted-foreground">{timesUsualText(row.income, row.meanPrior)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </figure>
    </PageState>
  );
}
