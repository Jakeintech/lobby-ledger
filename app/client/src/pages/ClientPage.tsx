import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';
import { sql } from '@databricks/appkit-ui/js';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { EngagementTable } from '@/components/EngagementTable';
import { EntityLink } from '@/components/EntityLink';
import { PageState } from '@/components/PageState';
import { QuarterChart } from '@/components/QuarterChart';
import { StatTiles } from '@/components/StatTiles';
import type { StatTile } from '@/components/StatTiles';
import { count, money, quarterLabel, toNumber } from '@/lib/format';
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

/** The issue codes on the entity's filings, each a link to its topic page. */
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="sr-only">{title}</h2>
      {children}
    </section>
  );
}

/** Trims a filer's free-text description and ends it with a full stop, or returns an empty string. */
function sentence(text: string | null | undefined): string {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? ` ${trimmed}` : ` ${trimmed}.`;
}

const SLICE_NOTE = 'The data covers every registrant and client pair with a $500,000 filing in 2024 or 2025.';
const formatMoney = (n: number) => money(n);

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
  const [quarter, setQuarter] = useState<string | null>(null);

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

  const tiles = useMemo<StatTile[]>(
    () =>
      client
        ? [
            {
              id: 'income',
              label: 'Reported income',
              value: money(client.total_income),
              hint: 'U.S. dollars on quarterly reports',
              countUp: { to: toNumber(client.total_income), format: formatMoney },
            },
            {
              id: 'firms',
              label: 'Firms hired',
              value: count(client.firm_count),
              hint: 'registrants with a filing',
            },
            {
              id: 'quarters',
              label: 'Quarters active',
              value: count(client.quarters_active),
              hint: 'of 8 quarters',
            },
            {
              id: 'lobbyists',
              label: 'Lobbyists',
              value: count(client.lobbyist_count),
              hint: 'named on its filings',
            },
          ]
        : [],
    [client]
  );

  const state = client?.state?.trim();
  const description = sentence(client?.description);

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
              <h1 className="text-3xl tracking-tight">{client.name}</h1>
              <p className="text-muted-foreground">
                {state ? `A client registered in ${state}` : 'A client'} that hired{' '}
                {count(client.firm_count) === '1' ? 'one lobbying firm' : `${count(client.firm_count)} lobbying firms`}{' '}
                in 2024 to 2025.{description}
              </p>
            </div>
            <TopicLinks codes={client.issue_codes} />
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
            selected={quarter}
            onSelect={setQuarter}
          />
        </PageState>
      </Section>

      <section aria-labelledby="client-firms-heading" className="space-y-3">
        <PageState
          loading={engagements.loading}
          error={engagements.error}
          empty={engagementRows.length === 0}
          emptyTitle="No firms hired"
          emptyMessage={`No engagement in the data lists ${name} as the client. ${SLICE_NOTE}`}
          onRetry={onRetry}
        >
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="border-t border-border pt-3">
                <h2 id="client-firms-heading" className="text-base font-medium text-foreground">
                  Firms hired by {name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {count(engagementRows.length)} {engagementRows.length === 1 ? 'engagement' : 'engagements'}
                  {quarter ? `, showing those active in ${quarterLabel(quarter)}` : ''}, in U.S. dollars on quarterly
                  reports, 2024 to 2025. Each row is one firm and client pair. Click a column to sort.
                </p>
              </div>
              <EngagementTable rows={engagementRows} hide="client" quarterFilter={quarter} />
            </div>
            <BillsAndEntities rows={engagementRows} clientName={name} />
          </div>
        </PageState>
      </section>

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
