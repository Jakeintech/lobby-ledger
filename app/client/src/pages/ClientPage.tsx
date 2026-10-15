import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';
import { sql } from '@databricks/appkit-ui/js';
import { Badge, useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { EngagementTable } from '@/components/EngagementTable';
import { EntityLink } from '@/components/EntityLink';
import { PageState } from '@/components/PageState';
import { QuarterChart } from '@/components/QuarterChart';
import { StatTiles } from '@/components/StatTiles';
import { count, money, toNumber } from '@/lib/format';
import { usePageTitle } from '@/lib/usePageTitle';
import { BillsAndEntities } from '@/pages/Client/BillsAndEntities';
import { ClientLobbyists } from '@/pages/Client/ClientLobbyists';

/**
 * The analytics hook shares one request per query and parameter set and
 * only starts it on first mount, so a retry has to unmount every section,
 * let the store drop the failed entry on the next tick, and mount again.
 */
function useRemount(): { attempt: number; settling: boolean; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [settling, setSettling] = useState(false);
  useEffect(() => {
    if (!settling) return;
    const timer = setTimeout(() => {
      setSettling(false);
      setAttempt((n) => n + 1);
    }, 0);
    return () => clearTimeout(timer);
  }, [settling]);
  return { attempt, settling, retry: () => setSettling(true) };
}

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

function TopicBadges({ codes }: { codes: string | null }) {
  const list = splitCodes(codes);
  if (list.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-sm text-muted-foreground">Issues lobbied:</span>
      {list.map((code) => (
        <Badge key={code} variant="outline" asChild>
          <EntityLink kind="topic" id={code} className="font-normal no-underline" />
        </Badge>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="sr-only">{title}</h2>
      {children}
    </section>
  );
}

const SLICE_NOTE = 'The data covers every registrant and client pair with a $500,000 filing in 2024 or 2025.';

/** Client page: income by quarter, the firms it hired, and the lobbyists those firms listed. */
export function ClientPage() {
  const { id = '' } = useParams();
  const { attempt, settling, retry } = useRemount();
  if (settling) {
    return (
      <PageState loading error={null} empty={false} emptyMessage="" onRetry={retry}>
        {null}
      </PageState>
    );
  }
  return <ClientBody key={attempt} id={id} onRetry={retry} />;
}

function ClientBody({ id, onRetry }: { id: string; onRetry: () => void }) {
  const params = useMemo(() => ({ id: sql.string(id) }), [id]);
  const detail = useAnalyticsQuery('client_detail', params);
  const quarters = useAnalyticsQuery('client_quarters', params);
  const engagements = useAnalyticsQuery('client_engagements', params);
  const lobbyists = useAnalyticsQuery('client_lobbyists', params);

  const client = detail.data?.[0];
  const name = client?.name?.trim() || `client ${id}`;
  usePageTitle(client?.name?.trim() || `Client ${id}`);

  const quarterRows = useMemo(
    () =>
      (quarters.data ?? []).map((row) => ({
        period_end_date: row.period_end_date,
        value: toNumber(row.income),
      })),
    [quarters.data]
  );
  const engagementRows = engagements.data ?? [];
  const lobbyistRows = lobbyists.data ?? [];

  const tiles = client
    ? [
        {
          id: 'income',
          label: 'Reported income',
          value: money(client.total_income),
          hint: 'U.S. dollars on quarterly reports, 2024 to 2025',
        },
        {
          id: 'firms',
          label: 'Firms hired',
          value: count(client.firm_count),
          hint: 'registrants with a filing, 2024 to 2025',
        },
        {
          id: 'quarters',
          label: 'Quarters active',
          value: count(client.quarters_active),
          hint: 'of 8 quarters, 2024 to 2025',
        },
        {
          id: 'lobbyists',
          label: 'Lobbyists',
          value: count(client.lobbyist_count),
          hint: 'named on its filings, 2024 to 2025',
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      <PageState
        loading={detail.loading}
        error={detail.error}
        empty={!client}
        emptyTitle="Client not found"
        emptyMessage={`No client with id ${id} is in the data. ${SLICE_NOTE}`}
        onRetry={onRetry}
      >
        {client && (
          <header className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Client</p>
              <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
              {client.description?.trim() && <p className="text-muted-foreground">{client.description.trim()}</p>}
              {client.state?.trim() && (
                <p className="text-sm text-muted-foreground">Registered in {client.state.trim()}.</p>
              )}
            </div>
            <TopicBadges codes={client.issue_codes} />
            <StatTiles tiles={tiles} columns={4} />
          </header>
        )}
      </PageState>

      <Section title="Income by quarter">
        <PageState
          loading={quarters.loading}
          error={quarters.error}
          empty={quarterRows.length === 0}
          emptyTitle="No quarterly income"
          emptyMessage={`No quarterly report for ${name} carried income in 2024 or 2025. Registrations and terminations report no income.`}
          onRetry={onRetry}
        >
          <QuarterChart
            title={`Income reported on ${name} filings by quarter`}
            rows={quarterRows}
            unit="dollars"
            valueLabel="Reported income"
          />
        </PageState>
      </Section>

      <Section title="Firms hired">
        <PageState
          loading={engagements.loading}
          error={engagements.error}
          empty={engagementRows.length === 0}
          emptyTitle="No firms hired"
          emptyMessage={`No engagement in the data lists ${name} as the client. ${SLICE_NOTE}`}
          onRetry={onRetry}
        >
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">Firms hired by {name}</h3>
              <p className="text-sm text-muted-foreground">
                {count(engagementRows.length)} {engagementRows.length === 1 ? 'engagement' : 'engagements'} ranked by
                reported income in U.S. dollars, 2024 to 2025. Each row is one firm and client pair.
              </p>
            </div>
            <EngagementTable rows={engagementRows} hide="client" />
            <BillsAndEntities rows={engagementRows} clientName={name} />
          </div>
        </PageState>
      </Section>

      <Section title="Lobbyists listed">
        <PageState
          loading={lobbyists.loading}
          error={lobbyists.error}
          empty={lobbyistRows.length === 0}
          emptyTitle="No lobbyists listed"
          emptyMessage={`No quarterly report for ${name} named an individual lobbyist in 2024 or 2025.`}
          onRetry={onRetry}
        >
          <ClientLobbyists rows={lobbyistRows} clientName={name} />
        </PageState>
      </Section>
    </div>
  );
}
