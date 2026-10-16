import { useMemo } from 'react';
import { useParams } from 'react-router';
import { sql } from '@databricks/appkit-ui/js';
import type { SQLStringMarker } from '@databricks/appkit-ui/js';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { EntityLink } from '@/components/EntityLink';
import { SLICE_NOTE } from '@/components/Layout';
import { PageState } from '@/components/PageState';
import { QuarterChart } from '@/components/QuarterChart';
import { RankedBars } from '@/components/RankedBars';
import type { RankedRow } from '@/components/RankedBars';
import { StatTiles } from '@/components/StatTiles';
import type { StatTile } from '@/components/StatTiles';
import { count, money, toNumber } from '@/lib/format';
import { firmPath } from '@/lib/routes';
import { usePageTitle } from '@/lib/usePageTitle';
import { OrganizationClientsTable } from '@/pages/Organization/OrganizationClientsTable';
import { HeaderSkeleton, Retryable } from '@/pages/Topic/Retryable';

/** The filing years in the data slice; every figure on the page covers this span. */
const PERIOD = '2024 to 2025';

type OrganizationParams = { id: SQLStringMarker };

interface SectionProps {
  name: string;
  params: OrganizationParams;
  onRetry: () => void;
}

const formatMoney = (n: number) => money(n);

function splitCodes(codes: string | null): string[] {
  return [
    ...new Set(
      (codes ?? '')
        .split(',')
        .map((code) => code.trim())
        .filter(Boolean)
    ),
  ];
}

/** The issue codes on the organization's filings, each a link to its topic page. */
function TopicLinks({ codes }: { codes: string | null }) {
  const list = splitCodes(codes);
  if (list.length === 0) return null;
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
      <span className="text-muted-foreground">Issues lobbied</span>
      {list.map((code) => (
        <EntityLink key={code} kind="topic" id={code} />
      ))}
    </p>
  );
}

/**
 * Organization page: one organization as Gold groups it, its client rows
 * across every firm that registered it, income by quarter over all of them,
 * the firms ranked, and the client rows themselves. In LDA data a client id
 * belongs to one registrant, so the same organization hired through three
 * firms is three client rows; Gold groups them by name with case and
 * punctuation removed.
 */
export function OrganizationPage() {
  const { id = '' } = useParams();
  const key = id.trim();
  return (
    <Retryable skeleton={<HeaderSkeleton />}>
      {(retry) => <OrganizationBody key={key} id={key} onRetry={retry} />}
    </Retryable>
  );
}

function OrganizationBody({ id, onRetry }: { id: string; onRetry: () => void }) {
  const params = useMemo<OrganizationParams>(() => ({ id: sql.string(id) }), [id]);
  const detail = useAnalyticsQuery('organization_detail', params);
  const row = detail.data?.[0];
  const name = row?.organization_name?.trim() || `organization ${id}`;
  usePageTitle(row?.organization_name?.trim() || `Organization ${id}`);

  const tiles = useMemo<StatTile[]>(() => {
    if (!row) return [];
    const income = toNumber(row.total_income);
    return [
      {
        id: 'income',
        label: 'Reported income',
        value: money(income),
        hint: 'U.S. dollars across every client row',
        countUp: { to: income, format: formatMoney },
      },
      { id: 'firms', label: 'Firms', value: count(row.firm_count), hint: 'registrants with a filing' },
      { id: 'clients', label: 'Client rows', value: count(row.client_count), hint: 'client ids grouped by name' },
      {
        id: 'quarters',
        label: 'Quarters active',
        value: count(row.quarters_active),
        hint: 'of 8 quarters',
      },
    ];
  }, [row]);

  return (
    <div className="space-y-10">
      <PageState
        loading={detail.loading}
        error={detail.error}
        empty={!row}
        emptyTitle="Organization not found"
        emptyMessage={`No organization with id ${id} is in the data. Organization ids are the hash of a client name with case and punctuation removed. ${SLICE_NOTE}`}
        onRetry={onRetry}
        skeleton={<HeaderSkeleton />}
      >
        {row && (
          <header className="space-y-5">
            <div className="space-y-2">
              <h1 className="text-3xl tracking-tight sm:text-4xl">{row.organization_name}</h1>
              <p className="text-muted-foreground">
                An organization that appears as{' '}
                {count(row.client_count) === '1' ? 'one client row' : `${count(row.client_count)} client rows`} across{' '}
                {count(row.firm_count) === '1' ? 'one lobbying firm' : `${count(row.firm_count)} lobbying firms`} in{' '}
                {PERIOD}. Each firm registers its own client id, so the rows are grouped here by name with case and
                punctuation removed.
              </p>
            </div>
            <TopicLinks codes={row.issue_codes} />
            <StatTiles tiles={tiles} columns={4} />
          </header>
        )}
      </PageState>

      {row && (
        <>
          <Retryable>{(retry) => <OrganizationQuarters name={name} params={params} onRetry={retry} />}</Retryable>
          <Retryable>{(retry) => <OrganizationFirms name={name} params={params} onRetry={retry} />}</Retryable>
          <Retryable>{(retry) => <OrganizationClients name={name} params={params} onRetry={retry} />}</Retryable>
        </>
      )}
    </div>
  );
}

function OrganizationQuarters({ name, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('organization_quarters', params);
  const rows = useMemo(
    () => (data ?? []).map((row) => ({ period_end_date: row.period_end_date, value: toNumber(row.income) })),
    [data]
  );
  return (
    <section aria-label="Income by quarter" className="space-y-3">
      <h2 className="sr-only">Income by quarter</h2>
      <PageState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyTitle="No quarterly income"
        emptyMessage={`No quarterly report for any ${name} client row carried income in ${PERIOD}. Registrations and terminations report no income.`}
        onRetry={onRetry}
      >
        <QuarterChart
          title={`Income reported across ${name} client rows by quarter`}
          rows={rows}
          unit="dollars"
          valueLabel="Reported income"
          height={280}
        />
      </PageState>
    </section>
  );
}

function OrganizationFirms({ name, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('organization_firms', params);
  // One firm can register the organization under more than one client id; the bar sums them.
  const rows = useMemo<RankedRow[]>(() => {
    const byFirm = new Map<string, RankedRow>();
    for (const row of data ?? []) {
      const id = String(row.registrant_id);
      const existing = byFirm.get(id);
      const value = toNumber(row.total_income);
      if (existing) existing.value += value;
      else byFirm.set(id, { id, name: row.firm?.trim() || id, value, href: firmPath(id) });
    }
    return [...byFirm.values()];
  }, [data]);
  return (
    <section aria-label="Firms" className="space-y-3">
      <h2 className="sr-only">Firms</h2>
      <PageState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyTitle="No firms"
        emptyMessage={`No engagement in the data lists a ${name} client row. ${SLICE_NOTE}`}
        onRetry={onRetry}
      >
        <RankedBars
          title={`Firms that registered ${name}, by reported income`}
          rows={rows}
          unit="dollars"
          subtitle={`${count(rows.length)} ${rows.length === 1 ? 'firm' : 'firms'}, U.S. dollars on quarterly reports, ${PERIOD}. A firm that registered more than one client row counts once, with the rows summed.`}
        />
      </PageState>
    </section>
  );
}

function OrganizationClients({ name, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('organization_clients', params);
  const rows = data ?? [];
  return (
    <section aria-label="Client rows" className="space-y-3">
      <h2 className="sr-only">Client rows</h2>
      <PageState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyTitle="No client rows"
        emptyMessage={`No client in the data is grouped under ${name}. ${SLICE_NOTE}`}
        onRetry={onRetry}
      >
        <OrganizationClientsTable rows={rows} name={name} />
      </PageState>
    </section>
  );
}
