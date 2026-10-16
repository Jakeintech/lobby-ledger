import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { sql } from '@databricks/appkit-ui/js';
import type { SQLStringMarker } from '@databricks/appkit-ui/js';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { PageState } from '@/components/PageState';
import { QuarterChart } from '@/components/QuarterChart';
import { StatTiles } from '@/components/StatTiles';
import type { StatTile } from '@/components/StatTiles';
import { count, money, toNumber } from '@/lib/format';
import { FOREIGN_PATH } from '@/lib/routes';
import { usePageTitle } from '@/lib/usePageTitle';
import { CountryClientsTable } from '@/pages/Foreign/CountryClientsTable';
import { countryName } from '@/pages/Foreign/country';
import { HeaderSkeleton, Retryable } from '@/pages/Topic/Retryable';
import { LINK_CLASS } from '@/components/EntityLink';

/** The filing years in the data slice; every figure on the page covers this span. */
const PERIOD = '2024 to 2025';

type CountryParams = { country: SQLStringMarker };

interface SectionProps {
  /** The country's name, for the section titles; the code stays in `params`. */
  country: string;
  params: CountryParams;
  onRetry: () => void;
}

const compactMoney = (n: number) => money(n, { compact: true });

/**
 * Foreign country page: one country, its linked income by quarter, and the
 * clients behind it. The URL carries the two-letter code; the page shows
 * the country's name wherever Gold supplies one.
 */
export function ForeignCountryPage() {
  const { country = '' } = useParams();
  const code = country.trim();
  return (
    <Retryable skeleton={<HeaderSkeleton />}>
      {(retry) => <CountryBody key={code} country={code} onRetry={retry} />}
    </Retryable>
  );
}

function CountryBody({ country, onRetry }: { country: string; onRetry: () => void }) {
  const params = useMemo<CountryParams>(() => ({ country: sql.string(country) }), [country]);
  const detail = useAnalyticsQuery('foreign_country_detail', params);
  const row = detail.data?.[0];
  const name = row ? countryName(row) : country;
  usePageTitle(row ? `${name} foreign-linked lobbying` : country);

  const tiles = useMemo<StatTile[]>(() => {
    if (!row) return [];
    const income = toNumber(row.income);
    return [
      {
        id: 'income',
        label: 'Reported income',
        value: compactMoney(income),
        hint: 'U.S. dollars on linked filings',
        countUp: { to: income, format: compactMoney },
      },
      {
        id: 'engagements',
        label: 'Engagements',
        value: count(row.engagement_count),
        hint: 'firm and client pairs',
      },
      { id: 'clients', label: 'Clients', value: count(row.client_count), hint: 'organizations' },
      {
        id: 'entities',
        label: 'Foreign entities',
        value: count(row.foreign_entity_count),
        hint: `named on filings, based in ${name}`,
      },
    ];
  }, [row, name]);

  return (
    <div className="space-y-10">
      <PageState
        loading={detail.loading}
        error={detail.error}
        empty={!row}
        emptyTitle={`No filings linked to ${country || 'this country'}`}
        emptyMessage={`No quarterly report in the ${PERIOD} filings names a foreign entity from ${country || 'this country'} or a client based there, or the foreign entity tables have not been built yet. The Foreign page lists every country that has filings.`}
        onRetry={onRetry}
        skeleton={<HeaderSkeleton />}
        backHref={FOREIGN_PATH}
        backLabel="Back to Foreign"
      >
        {row && (
          <header className="space-y-5">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl">{name}</h1>
              <p className="text-muted-foreground">
                Ranked {count(row.rank)} of all{' '}
                <Link to={FOREIGN_PATH} className={LINK_CLASS}>
                  countries
                </Link>{' '}
                by income on filings that name a foreign entity from {name} or a client based there, {PERIOD}. A filing
                counts in full toward every country it is linked to.
              </p>
            </div>
            <StatTiles tiles={tiles} columns={4} />
          </header>
        )}
      </PageState>

      {row && (
        <>
          <Retryable>{(retry) => <CountryQuarters country={name} params={params} onRetry={retry} />}</Retryable>
          <Retryable>{(retry) => <CountryClients country={name} params={params} onRetry={retry} />}</Retryable>
        </>
      )}
    </div>
  );
}

function CountryQuarters({ country, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('foreign_country_quarters', params);
  const rows = useMemo(
    () => (data ?? []).map((row) => ({ period_end_date: row.period_end_date, value: toNumber(row.income) })),
    [data]
  );
  return (
    <PageState
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyTitle="No quarterly figures"
      emptyMessage={`No quarterly report in the ${PERIOD} filings is linked to ${country}, so there is no income to chart.`}
      onRetry={onRetry}
      backHref={FOREIGN_PATH}
      backLabel="Back to Foreign"
    >
      <QuarterChart
        title={`Income on filings linked to ${country} by quarter`}
        rows={rows}
        unit="dollars"
        valueLabel="Reported income"
        zoom
        height={280}
      />
    </PageState>
  );
}

function CountryClients({ country, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('foreign_country_clients', params);
  const rows = data ?? [];
  return (
    <PageState
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyTitle="No clients linked"
      emptyMessage={`No client in the ${PERIOD} filings is linked to ${country} through a foreign entity or its own place of business.`}
      onRetry={onRetry}
      backHref={FOREIGN_PATH}
      backLabel="Back to Foreign"
    >
      <CountryClientsTable rows={rows} country={country} />
    </PageState>
  );
}
