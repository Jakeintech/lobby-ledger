import { useMemo } from 'react';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { PageState } from '@/components/PageState';
import { StatTiles } from '@/components/StatTiles';
import type { StatTile } from '@/components/StatTiles';
import { count, money, toNumber } from '@/lib/format';
import { topicPath } from '@/lib/routes';

/** `home_topics` takes no parameters; one shared object keeps the hook's cache key stable. */
const NO_PARAMS: Record<string, never> = {};

export interface TopicTilesProps {
  onRetry: () => void;
}

/**
 * Issue areas ranked by reported income. Each tile is a link to the topic
 * page. Totals overlap across tiles because a filing's income counts in full
 * toward every issue it lists, so the page never sums them.
 */
export function TopicTiles({ onRetry }: TopicTilesProps) {
  const { data, loading, error } = useAnalyticsQuery('home_topics', NO_PARAMS);

  const tiles = useMemo<StatTile[]>(
    () =>
      [...(data ?? [])]
        .sort((a, b) => toNumber(b.total_income) - toNumber(a.total_income))
        .map((row) => {
          const engagements = toNumber(row.engagement_count);
          return {
            id: row.issue_code,
            label: row.issue_name?.trim() || row.issue_code,
            value: money(row.total_income, { compact: true }),
            hint: `${row.issue_code}, ${count(engagements)} ${engagements === 1 ? 'engagement' : 'engagements'}`,
            href: topicPath(row.issue_code),
          };
        }),
    [data]
  );

  return (
    <PageState
      loading={loading}
      error={error}
      empty={!loading && !error && tiles.length === 0}
      emptyTitle="No issue areas"
      emptyMessage="No filing in the data lists an issue code, so there are no topics to rank."
      onRetry={onRetry}
    >
      <StatTiles tiles={tiles} columns={3} />
    </PageState>
  );
}
