import { useMemo } from 'react';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { PageState } from '@/components/PageState';
import { StatTiles } from '@/components/StatTiles';
import type { StatTile } from '@/components/StatTiles';
import { count, quarterLabel, toNumber } from '@/lib/format';

/** `about_freshness` takes no parameters; one shared object keeps the hook's cache key stable. */
const NO_PARAMS: Record<string, never> = {};

export interface DataFreshnessProps {
  onRetry: () => void;
}

/** The newest quarter in Gold and how many engagements and quarterly reports it covers. */
export function DataFreshness({ onRetry }: DataFreshnessProps) {
  const { data, loading, error } = useAnalyticsQuery('about_freshness', NO_PARAMS);
  const row = data?.[0];

  const tiles = useMemo<StatTile[]>(() => {
    if (!row) return [];
    return [
      {
        id: 'latest',
        label: 'Newest quarter',
        value: row.latest_period ? quarterLabel(row.latest_period) : 'None',
        hint: 'latest quarter end with a filing',
      },
      {
        id: 'engagements',
        label: 'Engagements',
        value: count(row.engagement_count),
        hint: 'firm and client pairs, 2024 to 2025',
      },
      {
        id: 'filings',
        label: 'Quarterly reports',
        value: count(row.filing_count),
        hint: 'latest amendment per quarter',
      },
    ];
  }, [row]);

  return (
    <PageState
      loading={loading}
      error={error}
      empty={!loading && !error && (!row || toNumber(row.filing_count) === 0)}
      emptyTitle="No filings loaded"
      emptyMessage="Gold holds no quarterly reports yet, so there is no newest quarter to show."
      onRetry={onRetry}
    >
      <StatTiles tiles={tiles} columns={3} />
    </PageState>
  );
}
