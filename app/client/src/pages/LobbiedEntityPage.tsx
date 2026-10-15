import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { sql } from '@databricks/appkit-ui/js';
import type { SQLStringMarker } from '@databricks/appkit-ui/js';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { PageState } from '@/components/PageState';
import { QuarterChart } from '@/components/QuarterChart';
import { RankedBars } from '@/components/RankedBars';
import { StatTiles } from '@/components/StatTiles';
import type { StatTile } from '@/components/StatTiles';
import { count, money, toNumber } from '@/lib/format';
import { LOBBIED_PATH, topicPath } from '@/lib/routes';
import { usePageTitle } from '@/lib/usePageTitle';
import { EntityClientsTable } from '@/pages/Lobbied/EntityClientsTable';
import { HeaderSkeleton, Retryable } from '@/pages/Topic/Retryable';
import { LINK_CLASS } from '@/components/EntityLink';

/** The filing years in the data slice; every figure on the page covers this span. */
const PERIOD = '2024 to 2025';

type EntityParams = { id: SQLStringMarker };

interface SectionProps {
  name: string;
  params: EntityParams;
  onRetry: () => void;
}

const compactMoney = (n: number) => money(n, { compact: true });

/** `House` reads as `a House office`; `Agency` as `an agency`; anything else passes through. */
function describeGroup(group: string | null | undefined): string {
  switch (group?.trim()) {
    case 'House':
      return 'An office or committee of the House of Representatives';
    case 'Senate':
      return 'An office or committee of the Senate';
    case 'White House':
      return 'Part of the Executive Office of the President';
    case 'Agency':
      return 'An executive department, agency or commission';
    default:
      return group?.trim() ? `Classified as ${group.trim()}` : 'A government entity';
  }
}

/** Lobbied entity page: one government entity, the income on reports naming it by quarter, its issue mix and its clients. */
export function LobbiedEntityPage() {
  const { id = '' } = useParams();
  const entityId = id.trim();
  return (
    <Retryable skeleton={<HeaderSkeleton />}>
      {(retry) => <EntityBody key={entityId} id={entityId} onRetry={retry} />}
    </Retryable>
  );
}

function EntityBody({ id, onRetry }: { id: string; onRetry: () => void }) {
  const params = useMemo<EntityParams>(() => ({ id: sql.string(id) }), [id]);
  const detail = useAnalyticsQuery('government_entity_detail', params);
  const entity = detail.data?.[0];
  usePageTitle(entity?.entity_name ?? 'Government entity');

  const tiles = useMemo<StatTile[]>(() => {
    if (!entity) return [];
    const income = toNumber(entity.income);
    return [
      {
        id: 'income',
        label: 'Reported income',
        value: compactMoney(income),
        hint: 'U.S. dollars on reports naming it',
        countUp: { to: income, format: compactMoney },
      },
      {
        id: 'engagements',
        label: 'Engagements',
        value: count(entity.engagement_count),
        hint: 'firm and client pairs',
      },
      { id: 'clients', label: 'Clients', value: count(entity.client_count), hint: 'organizations' },
      { id: 'firms', label: 'Firms', value: count(entity.firm_count), hint: 'registrants' },
    ];
  }, [entity]);

  return (
    <div className="space-y-10">
      <PageState
        loading={detail.loading}
        error={detail.error}
        empty={!entity}
        emptyTitle="No government entity with this id"
        emptyMessage={`No quarterly report in the ${PERIOD} filings names a government entity with this key, or the government entity tables have not been built yet. The Lobbied page lists every entity that has reports.`}
        onRetry={onRetry}
        skeleton={<HeaderSkeleton />}
        backHref={LOBBIED_PATH}
        backLabel="Back to Lobbied"
      >
        {entity && (
          <header className="space-y-5">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl">{entity.entity_name}</h1>
              <p className="text-muted-foreground">
                {describeGroup(entity.chamber_or_agency)}, ranked {count(entity.rank)} of all{' '}
                <Link to={LOBBIED_PATH} className={LINK_CLASS}>
                  entities lobbied
                </Link>{' '}
                by the income on quarterly reports that name it as contacted, {PERIOD}. A report counts in full toward
                every entity it names.
              </p>
            </div>
            <StatTiles tiles={tiles} columns={4} />
          </header>
        )}
      </PageState>

      {entity && (
        <>
          <Retryable>
            {(retry) => <EntityQuarters name={entity.entity_name} params={params} onRetry={retry} />}
          </Retryable>
          <Retryable>{(retry) => <EntityIssues name={entity.entity_name} params={params} onRetry={retry} />}</Retryable>
          <Retryable>
            {(retry) => <EntityClients name={entity.entity_name} params={params} onRetry={retry} />}
          </Retryable>
        </>
      )}
    </div>
  );
}

function EntityQuarters({ name, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('government_entity_quarters', params);
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
      emptyMessage={`No quarterly report in the ${PERIOD} filings names ${name} as contacted, so there is no income to chart.`}
      onRetry={onRetry}
      backHref={LOBBIED_PATH}
      backLabel="Back to Lobbied"
    >
      <QuarterChart
        title={`Income on reports naming ${name} by quarter`}
        rows={rows}
        unit="dollars"
        valueLabel="Reported income"
        zoom
        height={280}
      />
    </PageState>
  );
}

function EntityIssues({ name, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('government_entity_issues', params);
  const rows = useMemo(
    () =>
      (data ?? []).map((row) => ({
        id: row.issue_code,
        name: row.issue_code,
        value: toNumber(row.income),
        href: topicPath(row.issue_code),
      })),
    [data]
  );
  return (
    <PageState
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyTitle="No issue codes"
      emptyMessage={`No quarterly report naming ${name} lists an issue code, so there is no issue mix to rank.`}
      onRetry={onRetry}
      backHref={LOBBIED_PATH}
      backLabel="Back to Lobbied"
    >
      <RankedBars
        title={`Issue areas on reports naming ${name}`}
        rows={rows}
        unit="dollars"
        subtitle={`Reported income in U.S. dollars by issue code, ${PERIOD}. A report counts in full toward every issue it lists. Each code links to the issue area.`}
      />
    </PageState>
  );
}

function EntityClients({ name, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('government_entity_clients', params);
  const rows = data ?? [];
  return (
    <PageState
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyTitle="No clients"
      emptyMessage={`No client's quarterly report in the ${PERIOD} filings names ${name} as contacted.`}
      onRetry={onRetry}
      backHref={LOBBIED_PATH}
      backLabel="Back to Lobbied"
    >
      <EntityClientsTable rows={rows} entityName={name} />
    </PageState>
  );
}
