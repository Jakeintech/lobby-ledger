import { useMemo } from 'react';
import { Link } from 'react-router';
import { Skeleton, useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { PageState } from '@/components/PageState';
import { RankedBars } from '@/components/RankedBars';
import type { RankedRow } from '@/components/RankedBars';
import { toNumber } from '@/lib/format';
import {
  FOREIGN_PATH,
  LOBBIED_PATH,
  TRENDS_PATH,
  foreignCountryPath,
  lobbiedEntityPath,
  trendPath,
} from '@/lib/routes';
import { countryName } from '@/pages/Foreign/country';
import { RetrySection } from '@/pages/Home/RetrySection';
import { LINK_CLASS } from '@/components/EntityLink';

/** The filing years in the data slice; every figure here covers this span. */
const PERIOD = '2024 to 2025';

/** None of the three queries takes parameters; one shared object keeps the hook's cache key stable. */
const NO_PARAMS: Record<string, never> = {};

const TOP_TERMS = 8;
const TOP_COUNTRIES = 5;
const TOP_ENTITIES = 5;

interface CompactRankedProps {
  title: string;
  subtitle: string;
  rows: RankedRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Why the list is empty, in one sentence. */
  emptyMessage: string;
  /** The list page this row summarizes. */
  listHref: string;
  listLabel: string;
}

function RowSkeleton() {
  return (
    <div className="space-y-3 border-t border-border pt-3" aria-busy="true" aria-live="polite">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

/** One compact ranked row: the bars when there are rows, an honest line and a link when there are none. */
function CompactRanked({
  title,
  subtitle,
  rows,
  loading,
  error,
  onRetry,
  emptyMessage,
  listHref,
  listLabel,
}: CompactRankedProps) {
  return (
    <PageState
      loading={loading}
      error={error}
      empty={false}
      emptyMessage=""
      onRetry={onRetry}
      skeleton={<RowSkeleton />}
    >
      {rows.length === 0 ? (
        <figure className="min-w-0">
          <figcaption className="border-t border-border pt-3">
            <p className="font-medium text-foreground">{title}</p>
          </figcaption>
          <p className="py-4 text-sm text-muted-foreground">
            {emptyMessage}{' '}
            <Link to={listHref} className={LINK_CLASS}>
              {listLabel}
            </Link>
          </p>
        </figure>
      ) : (
        <div className="min-w-0">
          <RankedBars title={title} subtitle={subtitle} rows={rows} unit="dollars" />
          <p className="mt-3 text-sm">
            <Link to={listHref} className={LINK_CLASS}>
              {listLabel}
            </Link>
          </p>
        </div>
      )}
    </PageState>
  );
}

function TopTerms({ onRetry }: { onRetry: () => void }) {
  const { data, loading, error } = useAnalyticsQuery('terms', NO_PARAMS);
  const rows = useMemo<RankedRow[]>(
    () =>
      [...(data ?? [])]
        .map((row) => ({ id: row.term, name: row.term, value: toNumber(row.income), href: trendPath(row.term) }))
        .filter((row) => row.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, TOP_TERMS),
    [data]
  );
  return (
    <CompactRanked
      title={`Top ${TOP_TERMS} terms by reported income`}
      subtitle={`U.S. dollars on filings whose issue text contains the term, ${PERIOD}. Filings overlap across terms.`}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      emptyMessage={`No filing in the ${PERIOD} data mentions any of the tracked terms yet, so there is nothing to rank.`}
      listHref={TRENDS_PATH}
      listLabel="Search the filings for any phrase"
    />
  );
}

function TopForeignCountries({ onRetry }: { onRetry: () => void }) {
  const { data, loading, error } = useAnalyticsQuery('foreign_countries', NO_PARAMS);
  const rows = useMemo<RankedRow[]>(
    () =>
      [...(data ?? [])]
        .map((row) => ({
          id: row.country,
          name: countryName(row),
          value: toNumber(row.income),
          href: foreignCountryPath(row.country),
        }))
        .filter((row) => row.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, TOP_COUNTRIES),
    [data]
  );
  return (
    <CompactRanked
      title={`Top ${TOP_COUNTRIES} countries by foreign-linked income`}
      subtitle={`U.S. dollars on filings that list a foreign entity or a client based in the country, ${PERIOD}.`}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      emptyMessage={`No filing in the ${PERIOD} data lists a foreign entity or a client based outside the United States, so there is nothing to rank.`}
      listHref={FOREIGN_PATH}
      listLabel="See every country"
    />
  );
}

function TopLobbiedEntities({ onRetry }: { onRetry: () => void }) {
  const { data, loading, error } = useAnalyticsQuery('government_entities', NO_PARAMS);
  const rows = useMemo<RankedRow[]>(
    () =>
      [...(data ?? [])]
        .map((row) => ({
          id: row.entity_hk,
          name: row.entity_name,
          value: toNumber(row.income),
          href: lobbiedEntityPath(row.entity_hk),
        }))
        .filter((row) => row.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, TOP_ENTITIES),
    [data]
  );
  return (
    <CompactRanked
      title={`Top ${TOP_ENTITIES} government entities lobbied`}
      subtitle={`U.S. dollars on filings that name the entity as contacted, ${PERIOD}. A filing counts in full toward every entity it names.`}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      emptyMessage={`No filing in the ${PERIOD} data names a government entity as contacted, so there is nothing to rank.`}
      listHref={LOBBIED_PATH}
      listLabel="See every entity"
    />
  );
}

/**
 * Three compact ranked rows under the issue-area heatmap: the tracked terms,
 * the countries behind foreign-linked filings and the government entities
 * named as contacted. Each row retries on its own and says plainly when its
 * table has no rows yet.
 */
export function ConnectedRows() {
  return (
    <div className="grid gap-8 md:grid-cols-3">
      <RetrySection skeleton={<RowSkeleton />}>{(retry) => <TopTerms onRetry={retry} />}</RetrySection>
      <RetrySection skeleton={<RowSkeleton />}>{(retry) => <TopForeignCountries onRetry={retry} />}</RetrySection>
      <RetrySection skeleton={<RowSkeleton />}>{(retry) => <TopLobbiedEntities onRetry={retry} />}</RetrySection>
    </div>
  );
}
