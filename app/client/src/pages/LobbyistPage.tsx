import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';
import { sql } from '@databricks/appkit-ui/js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  useAnalyticsQuery,
} from '@databricks/appkit-ui/react';
import { PageState } from '@/components/PageState';
import { StatTiles } from '@/components/StatTiles';
import { count, quarterLabel } from '@/lib/format';
import { usePageTitle } from '@/lib/usePageTitle';
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

/**
 * Gold joins distinct covered positions with ` | `. The filings repeat them,
 * sometimes with and sometimes without a final full stop, so dedupe on the
 * text with trailing punctuation removed and keep the longest spelling.
 */
function splitPositions(positions: string | null): string[] {
  const byKey = new Map<string, string>();
  for (const part of (positions ?? '').split(' | ')) {
    const text = part.trim();
    if (!text) continue;
    const key = text.replace(/[\s.;,]+$/, '').toLowerCase();
    const existing = byKey.get(key);
    if (!existing || text.length > existing.length) byKey.set(key, text);
  }
  return [...byKey.values()];
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="sr-only">{title}</h2>
      {children}
    </section>
  );
}

function CoveredPositions({ positions, lobbyistName }: { positions: string[]; lobbyistName: string }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle>Disclosed former government positions</CardTitle>
        <CardDescription>
          The Lobbying Disclosure Act asks each filing to list the covered executive and legislative branch positions a
          lobbyist held in the previous twenty years. Shown verbatim from the filings, with the filer&apos;s own
          abbreviations and punctuation.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        {positions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No former government position was disclosed for {lobbyistName} on any filing in 2024 or 2025.
          </p>
        ) : (
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {positions.map((position) => (
              <li key={position} className="break-words">
                {position}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const SLICE_NOTE = 'The data covers every registrant and client pair with a $500,000 filing in 2024 or 2025.';

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
  const engagements = useAnalyticsQuery('lobbyist_engagements', params);

  const lobbyist = detail.data?.[0];
  const name = lobbyist?.full_name?.trim() || `lobbyist ${id}`;
  usePageTitle(lobbyist?.full_name?.trim() || `Lobbyist ${id}`);

  const positions = useMemo(() => splitPositions(lobbyist?.covered_positions ?? null), [lobbyist?.covered_positions]);
  const engagementRows = engagements.data ?? [];

  const tiles = lobbyist
    ? [
        {
          id: 'clients',
          label: 'Clients',
          value: count(lobbyist.client_count),
          hint: 'distinct clients, 2024 to 2025',
        },
        { id: 'firms', label: 'Firms', value: count(lobbyist.firm_count), hint: 'registrants that listed them' },
        {
          id: 'quarters',
          label: 'Quarters active',
          value: count(lobbyist.quarters_active),
          hint: 'of 8 quarters, 2024 to 2025',
        },
        {
          id: 'span',
          label: 'First quarter listed',
          value: lobbyist.first_period ? quarterLabel(lobbyist.first_period) : 'None',
          hint: lobbyist.last_period
            ? `last listed ${quarterLabel(lobbyist.last_period)}, 2024 to 2025`
            : 'only on a registration, 2024 to 2025',
        },
      ]
    : [];

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
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lobbyist</p>
              <h1 className="text-2xl font-semibold tracking-tight">{lobbyist.full_name}</h1>
              <p className="text-sm text-muted-foreground">
                As named on Lobbying Disclosure Act quarterly reports, 2024 to 2025.{' '}
                {lobbyist.first_period && lobbyist.last_period
                  ? `Listed from ${quarterLabel(lobbyist.first_period)} to ${quarterLabel(lobbyist.last_period)}.`
                  : 'Never listed on a quarterly report, only on a registration.'}
              </p>
            </div>
            <StatTiles tiles={tiles} columns={4} />
            <Section title="Disclosed former government positions">
              <CoveredPositions positions={positions} lobbyistName={name} />
            </Section>
          </header>
        )}
      </PageState>

      <Section title="Engagements and quarters active">
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
