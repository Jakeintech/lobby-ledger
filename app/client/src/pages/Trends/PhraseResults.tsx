import { useMemo } from 'react';
import { sql } from '@databricks/appkit-ui/js';
import type { SQLStringMarker } from '@databricks/appkit-ui/js';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { PageState } from '@/components/PageState';
import { RankedBars } from '@/components/RankedBars';
import { StatTiles } from '@/components/StatTiles';
import type { StatTile } from '@/components/StatTiles';
import { count, money, quarterLabel, toNumber } from '@/lib/format';
import { spanText } from '@/lib/ledger';
import { clientPath, trendsPath } from '@/lib/routes';
import { TrendChart } from '@/pages/Trends/TrendChart';
import { Retryable } from '@/pages/Topic/Retryable';

/** The filing years in the data slice; every figure on the page covers this span. */
const PERIOD = '2024 to 2025';

type PhraseParams = { q: SQLStringMarker };

export interface PhraseResultsProps {
  /** The trimmed phrase typed into the search field. */
  q: string;
  onRetry: () => void;
}

const quoted = (q: string) => `“${q}”`;

/**
 * Live search over the specific issues text: the quarters a phrase appears
 * in and the clients whose filings mention it most. Both queries scan the
 * activity text on the warehouse, so they are slower than the tracked terms.
 */
export function PhraseResults({ q, onRetry }: PhraseResultsProps) {
  const params = useMemo<PhraseParams>(() => ({ q: sql.string(q) }), [q]);
  const subject = quoted(q);
  return (
    <section aria-labelledby="phrase-heading" className="space-y-8">
      <h2 id="phrase-heading" className="text-xl font-semibold tracking-tight">
        Filings mentioning {subject}
      </h2>
      <PhraseQuarters q={q} params={params} subject={subject} onRetry={onRetry} />
      <Retryable>{(retry) => <PhraseClients q={q} params={params} subject={subject} onRetry={retry} />}</Retryable>
    </section>
  );
}

interface PhraseSectionProps {
  q: string;
  params: PhraseParams;
  subject: string;
  onRetry: () => void;
}

function PhraseQuarters({ q, params, subject, onRetry }: PhraseSectionProps) {
  const { data, loading, error } = useAnalyticsQuery('trend_search', params);
  const rows = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.period_end_date.localeCompare(b.period_end_date)),
    [data]
  );
  const tiles = useMemo<StatTile[]>(() => {
    if (rows.length === 0) return [];
    const filings = rows.reduce((sum, row) => sum + toNumber(row.filings_mentioning), 0);
    const income = rows.reduce((sum, row) => sum + toNumber(row.income), 0);
    const span = spanText(rows[0].period_end_date, rows[rows.length - 1].period_end_date, quarterLabel) ?? PERIOD;
    return [
      {
        id: 'filings',
        label: 'Filings mentioning',
        value: count(filings),
        hint: `quarterly reports, ${span}`,
        countUp: { to: filings, format: count },
      },
      {
        id: 'income',
        label: 'Reported income',
        value: money(income, { compact: true }),
        hint: 'U.S. dollars on those filings',
      },
      {
        id: 'quarters',
        label: 'Quarters mentioned',
        value: count(rows.length),
        hint: `of 8 in ${PERIOD}`,
      },
    ];
  }, [rows]);
  return (
    <PageState
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyTitle={`No filing mentions ${subject}`}
      emptyMessage={`No quarterly report in the ${PERIOD} filings contains ${subject} in its specific issues text. Try a shorter phrase, or one of the tracked terms below.`}
      onRetry={onRetry}
      backHref={trendsPath()}
      backLabel="Clear the search"
    >
      <div className="space-y-6">
        <StatTiles tiles={tiles} columns={3} />
        <TrendChart subject={quoted(q)} rows={rows} />
      </div>
    </PageState>
  );
}

function PhraseClients({ params, subject, onRetry }: PhraseSectionProps) {
  const { data, loading, error } = useAnalyticsQuery('trend_search_clients', params);
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
      emptyMessage={`No client's filings mention ${subject} in ${PERIOD}, so there is no one to rank.`}
      onRetry={onRetry}
      backHref={trendsPath()}
      backLabel="Clear the search"
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
