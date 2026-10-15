import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';
import { sql } from '@databricks/appkit-ui/js';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { PageState } from '@/components/PageState';
import { StatTiles } from '@/components/StatTiles';
import type { StatTile } from '@/components/StatTiles';
import { count, quarterLabel, toNumber } from '@/lib/format';
import { spanText } from '@/lib/ledger';
import { usePageTitle } from '@/lib/usePageTitle';
import { CoveredPositions } from '@/pages/Lobbyist/CoveredPositions';
import { dedupePositions } from '@/pages/Lobbyist/positions';
import { EngagementTimeline } from '@/pages/Lobbyist/EngagementTimeline';

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="sr-only">{title}</h2>
      {children}
    </section>
  );
}

const SLICE_NOTE = 'The data covers every registrant and client pair with a $500,000 filing in 2024 or 2025.';
const formatCount = (n: number) => count(n);

/** Lobbyist page: who they lobbied for and through, the quarters they were listed, and any covered positions disclosed. */
export function LobbyistPage() {
  const { id = '' } = useParams();
  const { attempt, settling, retry } = useRemount();
  if (settling) {
    return (
      <PageState loading error={null} empty={false} emptyMessage="" onRetry={retry}>
        {null}
      </PageState>
    );
  }
  return <LobbyistBody key={attempt} id={id} onRetry={retry} />;
}

function LobbyistBody({ id, onRetry }: { id: string; onRetry: () => void }) {
  const params = useMemo(() => ({ id: sql.string(id) }), [id]);
  const detail = useAnalyticsQuery('lobbyist_detail', params);
  const positions = useAnalyticsQuery('lobbyist_positions', params);
  const engagements = useAnalyticsQuery('lobbyist_engagements', params);

  const lobbyist = detail.data?.[0];
  const name = lobbyist?.full_name?.trim() || `lobbyist ${id}`;
  usePageTitle(lobbyist?.full_name?.trim() || `Lobbyist ${id}`);

  /**
   * The positions query carries the quarters each disclosure spanned. When it
   * returns nothing, the detail row's joined list still names the positions,
   * so fall back to it rather than show none.
   */
  const positionList = useMemo(() => {
    const fromQuery = (positions.data ?? []).map((row) => ({
      text: row.position_text,
      first: row.first_period,
      last: row.last_period,
    }));
    if (fromQuery.length > 0) return dedupePositions(fromQuery);
    return dedupePositions(
      (lobbyist?.covered_positions ?? '').split(' | ').map((text) => ({ text, first: null, last: null }))
    );
  }, [positions.data, lobbyist?.covered_positions]);
  const engagementRows = engagements.data ?? [];

  const tiles = useMemo<StatTile[]>(
    () =>
      lobbyist
        ? [
            {
              id: 'clients',
              label: 'Clients',
              value: count(lobbyist.client_count),
              hint: 'distinct clients',
              countUp: { to: toNumber(lobbyist.client_count), format: formatCount },
            },
            { id: 'firms', label: 'Firms', value: count(lobbyist.firm_count), hint: 'registrants that listed them' },
            {
              id: 'quarters',
              label: 'Quarters active',
              value: count(lobbyist.quarters_active),
              hint: 'of 8 quarters',
            },
            {
              id: 'span',
              label: 'First quarter listed',
              value: lobbyist.first_period ? quarterLabel(lobbyist.first_period) : 'None',
              hint: lobbyist.last_period
                ? `last listed ${quarterLabel(lobbyist.last_period)}`
                : 'only on a registration',
            },
          ]
        : [],
    [lobbyist]
  );

  const span = lobbyist ? spanText(lobbyist.first_period, lobbyist.last_period, quarterLabel) : null;

  return (
    <div className="space-y-8">
      <PageState
        loading={detail.loading}
        error={detail.error}
        empty={!lobbyist}
        emptyTitle="Lobbyist not found"
        emptyMessage={`No lobbyist with id ${id} is in the data. ${SLICE_NOTE}`}
        onRetry={onRetry}
      >
        {lobbyist && (
          <header className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-3xl tracking-tight">{lobbyist.full_name}</h1>
              <p className="text-muted-foreground">
                A lobbyist named on Lobbying Disclosure Act quarterly reports for{' '}
                {count(lobbyist.client_count) === '1' ? 'one client' : `${count(lobbyist.client_count)} clients`}
                {span ? `, listed ${span}.` : ', never on a quarterly report, only on a registration.'}
              </p>
            </div>
            <StatTiles tiles={tiles} columns={4} />
          </header>
        )}
      </PageState>

      {lobbyist && (
        <Section title="Disclosed former government positions">
          <PageState
            loading={positions.loading}
            error={positions.error}
            empty={false}
            emptyMessage=""
            onRetry={onRetry}
          >
            <CoveredPositions positions={positionList} lobbyistName={name} />
          </PageState>
        </Section>
      )}

      <Section title="Engagements and quarters listed">
        <PageState
          loading={engagements.loading}
          error={engagements.error}
          empty={engagementRows.length === 0}
          emptyTitle="No engagements"
          emptyMessage={`No filing in the data named ${name} as a lobbyist. ${SLICE_NOTE}`}
          onRetry={onRetry}
        >
          <EngagementTimeline rows={engagementRows} lobbyistName={name} />
        </PageState>
      </Section>
    </div>
  );
}
