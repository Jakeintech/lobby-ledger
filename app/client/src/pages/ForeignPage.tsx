import { useMemo } from 'react';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { PageState } from '@/components/PageState';
import { StatTiles } from '@/components/StatTiles';
import type { StatTile } from '@/components/StatTiles';
import { count, money, toNumber } from '@/lib/format';
import { foreignCountryPath } from '@/lib/routes';
import { usePageTitle } from '@/lib/usePageTitle';
import { CountryTable } from '@/pages/Foreign/CountryTable';
import { countryName } from '@/pages/Foreign/country';
import { HeaderSkeleton, Retryable } from '@/pages/Topic/Retryable';

/** The filing years in the data slice; every figure on the page covers this span. */
const PERIOD = '2024 to 2025';

/** `foreign_countries` takes no parameters; one shared object keeps the hook's cache key stable. */
const NO_PARAMS: Record<string, never> = {};

const compactMoney = (n: number) => money(n, { compact: true });

/** Foreign page: every country with lobbying income linked to it, ranked, each a link to its page. */
export function ForeignPage() {
  usePageTitle('Foreign-linked lobbying');
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl">Foreign-linked lobbying</h1>
        <p className="text-muted-foreground">
          Countries ranked by the income on filings that list a foreign entity or a client based abroad, {PERIOD}.
        </p>
      </header>
      <Retryable skeleton={<HeaderSkeleton />}>{(retry) => <ForeignBody onRetry={retry} />}</Retryable>
    </div>
  );
}

function ForeignBody({ onRetry }: { onRetry: () => void }) {
  const { data, loading, error } = useAnalyticsQuery('foreign_countries', NO_PARAMS);
  const rows = useMemo(() => data ?? [], [data]);

  // Totals across countries. A filing linked to two countries counts toward both, so these overlap.
  const tiles = useMemo<StatTile[]>(() => {
    if (rows.length === 0) return [];
    const income = rows.reduce((sum, row) => sum + toNumber(row.income), 0);
    const top = rows[0];
    return [
      {
        id: 'countries',
        label: 'Countries',
        value: count(rows.length),
        hint: 'with at least one linked filing',
        countUp: { to: rows.length, format: count },
      },
      {
        id: 'income',
        label: 'Reported income',
        value: compactMoney(income),
        hint: 'U.S. dollars, summed over countries',
      },
      {
        id: 'engagements',
        label: 'Engagements',
        value: count(rows.reduce((sum, row) => sum + toNumber(row.engagement_count), 0)),
        hint: 'firm and client pairs, summed over countries',
      },
      {
        id: 'top',
        label: 'Largest',
        value: countryName(top),
        hint: `${compactMoney(toNumber(top.income))} on linked filings`,
        href: foreignCountryPath(top.country),
      },
    ];
  }, [rows]);

  return (
    <PageState
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyTitle="No foreign-linked filings loaded yet"
      emptyMessage={`The foreign entity tables are built after the main load of ${PERIOD} filings finishes, so no country can be ranked until then. Check back after the next load, or browse issue areas on Home.`}
      onRetry={onRetry}
      skeleton={<HeaderSkeleton />}
    >
      <StatTiles tiles={tiles} columns={4} />
      <p className="text-sm text-muted-foreground">
        A filing that names foreign entities from two countries counts in full toward both, so the totals above overlap
        and the table is not a breakdown of one sum.
      </p>
      <CountryTable rows={rows} />
    </PageState>
  );
}
