import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';
import { sql } from '@databricks/appkit-ui/js';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { EngagementTable } from '@/components/EngagementTable';
import { EntityLink } from '@/components/EntityLink';
import { SLICE_NOTE } from '@/components/Layout';
import { PageState } from '@/components/PageState';
import { QuarterChart } from '@/components/QuarterChart';
import { RankedBars } from '@/components/RankedBars';
import { StatTiles } from '@/components/StatTiles';
import type { StatTile } from '@/components/StatTiles';
import { count, money, quarterLabel, toNumber } from '@/lib/format';
import { clientPath } from '@/lib/routes';
import { usePageTitle } from '@/lib/usePageTitle';
import { FirmLobbyists } from '@/pages/Firm/FirmLobbyists';

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

function locationText(city: string | null, state: string | null): string | null {
  const parts = [city?.trim(), state?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

const TOP_CLIENTS = 10;
/** Trims a filer's free-text description and ends it with a full stop, or returns an empty string. */
function sentence(text: string | null | undefined): string {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? ` ${trimmed}` : ` ${trimmed}.`;
}

const formatMoney = (n: number) => money(n);

/** Firm page: income by quarter across all clients, the clients ranked, and the roster of lobbyists. */
export function FirmPage() {
  const { id = '' } = useParams();
  const { attempt, settling, retry } = useRemount();
  if (settling) {
    return (
      <PageState loading error={null} empty={false} emptyMessage="" onRetry={retry}>
        {null}
      </PageState>
    );
  }
  return <FirmBody key={attempt} id={id} onRetry={retry} />;
}

function FirmBody({ id, onRetry }: { id: string; onRetry: () => void }) {
  const params = useMemo(() => ({ id: sql.string(id) }), [id]);
  const detail = useAnalyticsQuery('firm_detail', params);
  const quarters = useAnalyticsQuery('firm_quarters', params);
  const clients = useAnalyticsQuery('firm_clients', params);
  const lobbyists = useAnalyticsQuery('firm_lobbyists', params);
  const [quarter, setQuarter] = useState<string | null>(null);

  const firm = detail.data?.[0];
  const name = firm?.name?.trim() || `firm ${id}`;
  usePageTitle(firm?.name?.trim() || `Firm ${id}`);

  const quarterRows = useMemo(
    () =>
      (quarters.data ?? []).map((row) => ({
        period_end_date: row.period_end_date,
        value: toNumber(row.income),
      })),
    [quarters.data]
  );
  const clientRows = useMemo(() => clients.data ?? [], [clients.data]);
  const lobbyistRows = lobbyists.data ?? [];

  const rankedClients = useMemo(
    () =>
      [...clientRows]
        .sort((a, b) => toNumber(b.total_income) - toNumber(a.total_income))
        .slice(0, TOP_CLIENTS)
        .map((row) => ({
          id: row.engagement_hk,
          name: row.client,
          value: toNumber(row.total_income),
          href: clientPath(row.client_id),
        })),
    [clientRows]
  );

  const tiles = useMemo<StatTile[]>(
    () =>
      firm
        ? [
            {
              id: 'income',
              label: 'Reported income',
              value: money(firm.total_income),
              hint: 'U.S. dollars across all clients',
              countUp: { to: toNumber(firm.total_income), format: formatMoney },
            },
            { id: 'clients', label: 'Clients', value: count(firm.client_count), hint: 'with a filing' },
            {
              id: 'lobbyists',
              label: 'Lobbyists',
              value: count(firm.lobbyist_count),
              hint: 'named on its filings',
            },
            {
              id: 'engagements',
              label: 'Engagements',
              value: count(firm.engagement_count),
              hint: 'firm and client pairs',
            },
          ]
        : [],
    [firm]
  );

  const location = firm ? locationText(firm.city, firm.state) : null;
  const description = sentence(firm?.description);

  return (
    <div className="space-y-8">
      <PageState
        loading={detail.loading}
        error={detail.error}
        empty={!firm}
        emptyTitle="Firm not found"
        emptyMessage={`No lobbying firm with registrant id ${id} is in the data. ${SLICE_NOTE}`}
        onRetry={onRetry}
      >
        {firm && (
          <header className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-3xl tracking-tight">{firm.name}</h1>
              <p className="text-muted-foreground">
                {location ? `A lobbying firm based in ${location}` : 'A lobbying firm'} with{' '}
                {count(firm.client_count) === '1' ? 'one client' : `${count(firm.client_count)} clients`} on file for
                2024 to 2025.{description}
              </p>
            </div>
            <TopicLinks codes={firm.issue_codes} />
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
          emptyMessage={`No quarterly report filed by ${name} carried income in 2024 or 2025. Registrations and terminations report no income.`}
          onRetry={onRetry}
        >
          <QuarterChart
            title={`Income reported by ${name} across all clients by quarter`}
            rows={quarterRows}
            unit="dollars"
            valueLabel="Reported income"
            selected={quarter}
            onSelect={setQuarter}
          />
        </PageState>
      </Section>

      <section aria-labelledby="firm-clients-heading" className="space-y-3">
        <PageState
          loading={clients.loading}
          error={clients.error}
          empty={clientRows.length === 0}
          emptyTitle="No clients"
          emptyMessage={`No engagement in the data lists ${name} as the registrant. ${SLICE_NOTE}`}
          onRetry={onRetry}
        >
          <div className="space-y-8">
            {/* With ten clients or fewer the table below, sorted by income, is already the ranking. */}
            {clientRows.length > TOP_CLIENTS && (
              <RankedBars
                title={`Top clients of ${name} by reported income`}
                rows={rankedClients}
                unit="dollars"
                subtitle={`Top ${TOP_CLIENTS} of ${count(clientRows.length)} clients, U.S. dollars on quarterly reports, 2024 to 2025.`}
              />
            )}
            <div className="space-y-3">
              <div className="border-t border-border pt-3">
                <h2 id="firm-clients-heading" className="text-base font-medium text-foreground">
                  Every client of {name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {count(clientRows.length)} {clientRows.length === 1 ? 'engagement' : 'engagements'}
                  {quarter ? `, showing those active in ${quarterLabel(quarter)}` : ''}, in U.S. dollars on quarterly
                  reports, 2024 to 2025. Click a column to sort.
                </p>
              </div>
              <EngagementTable rows={clientRows} hide="firm" quarterFilter={quarter} />
            </div>
          </div>
        </PageState>
      </section>

      <Section title="Lobbyists listed">
        <PageState
          loading={lobbyists.loading}
          error={lobbyists.error}
          empty={lobbyistRows.length === 0}
          emptyTitle="No lobbyists listed"
          emptyMessage={`No quarterly report filed by ${name} named an individual lobbyist in 2024 or 2025.`}
          onRetry={onRetry}
        >
          <FirmLobbyists rows={lobbyistRows} firmName={name} />
        </PageState>
      </Section>
    </div>
  );
}
