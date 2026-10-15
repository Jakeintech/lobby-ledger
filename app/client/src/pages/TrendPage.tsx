import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { sql } from '@databricks/appkit-ui/js';
import type { SQLStringMarker } from '@databricks/appkit-ui/js';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { EntityLink, LINK_CLASS } from '@/components/EntityLink';
import { PageState } from '@/components/PageState';
import { RankedBars } from '@/components/RankedBars';
import { StatTiles } from '@/components/StatTiles';
import type { StatTile } from '@/components/StatTiles';
import { count, money, quarterLabel, toNumber } from '@/lib/format';
import { spanText } from '@/lib/ledger';
import { clientPath, trendsPath } from '@/lib/routes';
import { usePageTitle } from '@/lib/usePageTitle';
import { HeaderSkeleton, Retryable } from '@/pages/Topic/Retryable';
import { TrendChart } from '@/pages/Trends/TrendChart';
import { trendsSearchPath } from '@/pages/Trends/paths';

/** The filing years in the data slice; every figure on the page covers this span. */
const PERIOD = '2024 to 2025';

type TermParams = { term: SQLStringMarker };

interface SectionProps {
  subject: string;
  params: TermParams;
  onRetry: () => void;
}

function pluralize(value: number | string, singular: string): string {
  const n = toNumber(value);
  return `${count(n)} ${n === 1 ? singular : `${singular}s`}`;
}

/** Trend page: one tracked phrase, the filings mentioning it by quarter, who pays, and the issue codes it falls under. */
export function TrendPage() {
  const { term = '' } = useParams();
  const normalized = term.trim().toLowerCase();
  return (
    <Retryable skeleton={<HeaderSkeleton />}>
      {(retry) => <TrendBody key={normalized} term={normalized} onRetry={retry} />}
    </Retryable>
  );
}

function TrendBody({ term, onRetry }: { term: string; onRetry: () => void }) {
  const params = useMemo<TermParams>(() => ({ term: sql.string(term) }), [term]);
  const detail = useAnalyticsQuery('term_detail', params);
  const row = detail.data?.[0];
  const subject = `“${term}”`;
  usePageTitle(`Trend: ${term}`);

  const tiles = useMemo<StatTile[]>(() => {
    if (!row) return [];
    const filings = toNumber(row.filings_mentioning);
    return [
      {
        id: 'filings',
        label: 'Filings mentioning',
        value: count(filings),
        hint: 'quarterly reports',
        countUp: { to: filings, format: count },
      },
      {
        id: 'engagements',
        label: 'Engagements',
        value: count(row.engagement_count),
        hint: 'firm and client pairs',
      },
      {
        id: 'income',
        label: 'Reported income',
        value: money(row.income, { compact: true }),
        hint: 'U.S. dollars on those filings',
      },
      {
        id: 'span',
        label: 'Quarters mentioned',
        value: spanText(row.first_period, row.last_period, quarterLabel) ?? 'None',
        hint: `within ${PERIOD}`,
      },
    ];
  }, [row]);

  return (
    <div className="space-y-10">
      <PageState
        loading={detail.loading}
        error={detail.error}
        empty={!row}
        emptyTitle={`${subject} is not a tracked term`}
        emptyMessage={`Only a fixed list of phrases is counted ahead of time, and ${subject} is not on it, or its counts have not been built yet. The Trends page can search the filing text for any phrase.`}
        onRetry={onRetry}
        skeleton={<HeaderSkeleton />}
        backHref={trendsSearchPath(term)}
        backLabel={`Search the filings for ${subject}`}
      >
        {row && (
          <header className="space-y-5">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl">{subject}</h1>
              <p className="text-muted-foreground">
                A tracked phrase, matched anywhere in the specific issues text of quarterly reports filed in {PERIOD}. A
                filing counts once however many times it uses the phrase.{' '}
                <Link to={trendsSearchPath(term)} className={LINK_CLASS}>
                  Search the filing text live
                </Link>{' '}
                or{' '}
                <Link to={trendsPath()} className={LINK_CLASS}>
                  see every tracked term
                </Link>
                .
              </p>
            </div>
            <StatTiles tiles={tiles} columns={4} />
          </header>
        )}
      </PageState>

      {row && (
        <>
          <Retryable>{(retry) => <TermQuarters subject={subject} params={params} onRetry={retry} />}</Retryable>
          <div className="grid gap-8 lg:grid-cols-2">
            <Retryable>{(retry) => <TermClients subject={subject} params={params} onRetry={retry} />}</Retryable>
            <Retryable>{(retry) => <TermIssues subject={subject} params={params} onRetry={retry} />}</Retryable>
          </div>
        </>
      )}
    </div>
  );
}

function TermQuarters({ subject, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('term_quarters', params);
  const rows = data ?? [];
  return (
    <PageState
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyTitle="No quarterly figures"
      emptyMessage={`No quarterly report in the ${PERIOD} filings mentions ${subject}, so there is nothing to chart.`}
      onRetry={onRetry}
      backHref={trendsPath()}
      backLabel="Back to Trends"
    >
      <TrendChart subject={subject} rows={rows} />
    </PageState>
  );
}

function TermClients({ subject, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('term_clients', params);
  const rows = useMemo(
    () =>
      (data ?? []).map((row) => ({
        id: row.client_id,
        name: row.client,
        value: toNumber(row.income),
        href: clientPath(row.client_id),
      })),
    [data]
  );
  return (
    <PageState
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyTitle="No clients ranked"
      emptyMessage={`No client's filings mention ${subject} in ${PERIOD}.`}
      onRetry={onRetry}
      backHref={trendsPath()}
      backLabel="Back to Trends"
    >
      <RankedBars
        title={`Clients whose filings mention ${subject}, by reported income`}
        subtitle={`Reported income in U.S. dollars on the quarterly reports that mention ${subject}, ${PERIOD}. Top ten; each name links to the client.`}
        rows={rows}
        unit="dollars"
      />
    </PageState>
  );
}

function TermIssues({ subject, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('term_issues', params);
  const rows = useMemo(
    () => [...(data ?? [])].sort((a, b) => toNumber(b.filings_mentioning) - toNumber(a.filings_mentioning)),
    [data]
  );
  return (
    <PageState
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyTitle="No issue codes"
      emptyMessage={`No filing mentioning ${subject} carries an issue code in ${PERIOD}.`}
      onRetry={onRetry}
      backHref={trendsPath()}
      backLabel="Back to Trends"
    >
      <figure className="min-w-0">
        <figcaption className="border-t border-border pt-3">
          <p className="font-medium text-foreground">Issue areas the filings mentioning {subject} are filed under</p>
          <p className="text-sm text-muted-foreground">
            Quarterly reports naming each issue code, {PERIOD}. A filing lists several codes, so the counts overlap.
            Each code is a link.
          </p>
        </figcaption>
        <ol className="mt-2 divide-y divide-border">
          {rows.map((row) => (
            <li key={row.issue_code} className="flex items-baseline justify-between gap-4 py-2">
              <EntityLink kind="topic" id={row.issue_code} />
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {pluralize(row.filings_mentioning, 'filing')}
              </span>
            </li>
          ))}
        </ol>
      </figure>
    </PageState>
  );
}
