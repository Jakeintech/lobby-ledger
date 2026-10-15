import { useCallback, useEffect, useMemo, useState } from 'react';
import { sql } from '@databricks/appkit-ui/js';
import { Button, Skeleton, useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { Heatmap } from '@/components/Heatmap';
import type { HeatmapRow } from '@/components/Heatmap';
import { PageState } from '@/components/PageState';
import { RankedBars } from '@/components/RankedBars';
import type { RankedRow } from '@/components/RankedBars';
import { count, toNumber } from '@/lib/format';
import { QUARTER_ENDS, quarterIndex } from '@/lib/ledger';
import { topicPath } from '@/lib/routes';

/** `home_topics` takes no parameters; one shared object keeps the hook's cache key stable. */
const NO_PARAMS: Record<string, never> = {};

/** How many issue areas the heatmap compares. */
const HEATMAP_ROWS = 12;

/** How many issue areas the ranked list shows before it is expanded. */
const RANKED_ROWS = 12;

interface QuarterReport {
  values: number[];
  failed: boolean;
}

interface TopicQuarterRowsProps {
  code: string;
  onReport: (code: string, report: QuarterReport) => void;
}

/**
 * One issue area's eight quarters. Gold has no topic-by-quarter query that
 * returns every issue in one call, so Home mounts one of these per heatmap
 * row and each reports its quarters up once the query settles. The analytics
 * hook shares the request with the topic page, so nothing is fetched twice.
 */
function TopicQuarterRows({ code, onReport }: TopicQuarterRowsProps) {
  const params = useMemo(() => ({ code: sql.string(code) }), [code]);
  const { data, loading, error } = useAnalyticsQuery('topic_quarters', params);
  useEffect(() => {
    if (loading) return;
    const values = QUARTER_ENDS.map(() => 0);
    for (const row of data ?? []) {
      const slot = quarterIndex(row.period_end_date);
      if (slot !== null) values[slot] += toNumber(row.income);
    }
    onReport(code, { values, failed: Boolean(error) });
  }, [code, data, loading, error, onReport]);
  return null;
}

export interface TopicOverviewProps {
  onRetry: () => void;
}

/**
 * Issue areas from one query: the top twelve as a quarter-by-quarter heatmap
 * and every issue with income as a ranked list of links. Totals overlap
 * across issues because a filing's income counts in full toward every issue
 * it lists, so nothing here is summed.
 */
export function TopicOverview({ onRetry }: TopicOverviewProps) {
  const { data, loading, error } = useAnalyticsQuery('home_topics', NO_PARAMS);
  const [showAll, setShowAll] = useState(false);
  const [reports, setReports] = useState<Record<string, QuarterReport>>({});

  const onReport = useCallback((code: string, report: QuarterReport) => {
    setReports((current) => ({ ...current, [code]: report }));
  }, []);

  const topics = useMemo(
    () =>
      [...(data ?? [])]
        .map((row) => ({
          id: row.issue_code,
          name: row.issue_name?.trim() ? `${row.issue_name.trim()} (${row.issue_code})` : row.issue_code,
          value: toNumber(row.total_income),
          href: topicPath(row.issue_code),
        }))
        .sort((a, b) => b.value - a.value),
    [data]
  );

  const heatmapTopics = useMemo(() => topics.slice(0, HEATMAP_ROWS), [topics]);
  const settled = heatmapTopics.every((topic) => topic.id in reports);
  const failedCount = heatmapTopics.filter((topic) => reports[topic.id]?.failed).length;
  const heatmapRows = useMemo<HeatmapRow[]>(
    () =>
      heatmapTopics.map((topic) => ({
        ...topic,
        values: reports[topic.id]?.values ?? QUARTER_ENDS.map(() => 0),
      })),
    [heatmapTopics, reports]
  );

  const withIncome = useMemo<RankedRow[]>(() => topics.filter((topic) => topic.value > 0), [topics]);
  const rankedRows = showAll ? withIncome : withIncome.slice(0, RANKED_ROWS);
  const hidden = withIncome.length - rankedRows.length;

  const heatmapNote =
    failedCount > 0
      ? `U.S. dollars by quarter end. Darker is more. Quarters for ${count(failedCount)} ${
          failedCount === 1 ? 'issue area' : 'issue areas'
        } could not be loaded and show as empty.`
      : 'U.S. dollars by quarter end. Darker is more. Click a cell to open the issue.';

  return (
    <PageState
      loading={loading}
      error={error}
      empty={!loading && !error && topics.length === 0}
      emptyTitle="No issue areas"
      emptyMessage="No filing in the data lists an issue code, so there are no topics to rank."
      onRetry={onRetry}
    >
      {heatmapTopics.map((topic) => (
        <TopicQuarterRows key={topic.id} code={topic.id} onReport={onReport} />
      ))}
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          {settled ? (
            <Heatmap
              title={`Top ${HEATMAP_ROWS} issue areas by quarter`}
              subtitle={heatmapNote}
              rows={heatmapRows}
              quarters={QUARTER_ENDS}
              unit="dollars"
            />
          ) : (
            <div className="space-y-3" aria-busy="true" aria-live="polite">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-80 w-full" />
            </div>
          )}
        </div>
        <div className="min-w-0 lg:col-span-2">
          <RankedBars
            title="Issue areas ranked by reported income"
            subtitle="U.S. dollars, 2024 to 2025. A filing counts in full toward every issue it lists, so these figures overlap and are not summed."
            rows={rankedRows}
            unit="dollars"
            emptyMessage="No issue area has reported income in the data."
          />
          {hidden > 0 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="mt-2 h-auto px-0 py-1"
              onClick={() => setShowAll(true)}
            >
              Show all {count(withIncome.length)} issue areas
            </Button>
          )}
        </div>
      </div>
    </PageState>
  );
}
