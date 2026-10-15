import { useMemo } from 'react';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { PageState } from '@/components/PageState';
import { QuarterChart } from '@/components/QuarterChart';
import { StatTiles } from '@/components/StatTiles';
import type { StatTile } from '@/components/StatTiles';
import { count, money, quarterLabel, toNumber } from '@/lib/format';

/** `home_quarters` takes no parameters; one shared object keeps the hook's cache key stable. */
const NO_PARAMS: Record<string, never> = {};

export interface IncomeOverviewProps {
  onRetry: () => void;
}

/**
 * The Home centerpiece: reported income across every engagement, one point
 * per quarter end, with the headline figures above it.
 */
export function IncomeOverview({ onRetry }: IncomeOverviewProps) {
  const { data, loading, error } = useAnalyticsQuery('home_quarters', NO_PARAMS);

  const quarters = useMemo(
    () =>
      [...(data ?? [])]
        .sort((a, b) => a.period_end_date.localeCompare(b.period_end_date))
        .map((row) => ({
          period_end_date: row.period_end_date,
          income: toNumber(row.income),
          engagements: toNumber(row.engagement_count),
        })),
    [data]
  );

  const tiles = useMemo<StatTile[]>(() => {
    if (quarters.length === 0) return [];
    const first = quarters[0];
    const last = quarters[quarters.length - 1];
    const total = quarters.reduce((sum, row) => sum + row.income, 0);
    const peak = quarters.reduce((best, row) => (row.income > best.income ? row : best), first);
    const span = `${quarterLabel(first.period_end_date)} to ${quarterLabel(last.period_end_date)}`;
    return [
      { id: 'total', label: 'Reported income', value: money(total, { compact: true }), hint: span },
      {
        id: 'peak',
        label: 'Highest quarter',
        value: money(peak.income, { compact: true }),
        hint: quarterLabel(peak.period_end_date),
      },
      {
        id: 'engagements',
        label: 'Engagements reporting',
        value: count(last.engagements),
        hint: `in ${quarterLabel(last.period_end_date)}`,
      },
      { id: 'quarters', label: 'Quarters covered', value: count(quarters.length), hint: span },
    ];
  }, [quarters]);

  const chartRows = useMemo(
    () => quarters.map((row) => ({ period_end_date: row.period_end_date, value: row.income })),
    [quarters]
  );

  return (
    <PageState
      loading={loading}
      error={error}
      empty={!loading && !error && quarters.length === 0}
      emptyTitle="No quarterly income"
      emptyMessage="No quarterly report in the data carries any income, so there is nothing to chart yet."
      onRetry={onRetry}
    >
      <div className="space-y-4">
        <StatTiles tiles={tiles} columns={4} />
        <QuarterChart
          title="Reported lobbying income by quarter, all engagements"
          rows={chartRows}
          unit="dollars"
          variant="line"
          valueLabel="Reported income"
        />
      </div>
    </PageState>
  );
}
