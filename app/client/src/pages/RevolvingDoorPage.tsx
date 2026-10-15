import { useMemo } from 'react';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { PageState } from '@/components/PageState';
import { StatTiles } from '@/components/StatTiles';
import type { StatTile } from '@/components/StatTiles';
import { count, money } from '@/lib/format';
import { HOME_PATH } from '@/lib/routes';
import { usePageTitle } from '@/lib/usePageTitle';
import { RevolvingDoorTable } from '@/pages/RevolvingDoor/RevolvingDoorTable';
import { normalizeRows, summarize } from '@/pages/RevolvingDoor/rows';
import type { RevolvingDoorRow } from '@/pages/RevolvingDoor/rows';
import { HeaderSkeleton, Retryable } from '@/pages/Topic/Retryable';

/** The filing years in the data slice; every figure on the page covers this span. */
const PERIOD = '2024 to 2025';

/** Neither query takes parameters; one shared object keeps the hook's cache key stable. */
const NO_PARAMS: Record<string, never> = {};

const compactMoney = (n: number) => money(n, { compact: true });

/**
 * Revolving door page: lobbyists whose filings disclose a former position in
 * Congress or an agency, matched by name to a committee, member or agency,
 * and the clients they now lobby for. Shows the engagements that contact the
 * former employer when Gold has any, and every matched lobbyist otherwise.
 */
export function RevolvingDoorPage() {
  usePageTitle('Revolving door');
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl">The revolving door</h1>
        <p className="text-muted-foreground">
          Lobbyists whose filings disclose a former position in Congress or an agency, and the clients they now lobby
          for. Each match is textual, made by name against standing committees, members of Congress and the government
          entities on filings, and rests on what the lobbyist disclosed, {PERIOD}.
        </p>
      </header>
      <Retryable skeleton={<HeaderSkeleton />}>{(retry) => <ConfirmedList onRetry={retry} />}</Retryable>
    </div>
  );
}

/** Engagements that contact the former employer. Falls through to every match when there are none. */
function ConfirmedList({ onRetry }: { onRetry: () => void }) {
  const { data, loading, error } = useAnalyticsQuery('revolving_door', NO_PARAMS);
  const rows = useMemo(() => normalizeRows(data ?? []), [data]);
  if (!loading && !error && rows.length === 0) {
    return <Retryable skeleton={<HeaderSkeleton />}>{(retry) => <AllMatchesList onRetry={retry} />}</Retryable>;
  }
  return (
    <PageState
      loading={loading}
      error={error}
      empty={false}
      emptyMessage=""
      onRetry={onRetry}
      skeleton={<HeaderSkeleton />}
    >
      <ListBody rows={rows} mode="confirmed" />
    </PageState>
  );
}

function AllMatchesList({ onRetry }: { onRetry: () => void }) {
  const { data, loading, error } = useAnalyticsQuery('revolving_door_all', NO_PARAMS);
  const rows = useMemo(() => normalizeRows(data ?? []), [data]);
  return (
    <PageState
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyTitle="No matched former positions"
      emptyMessage={`No lobbyist in the ${PERIOD} filings disclosed a former position whose text names a committee, member of Congress or agency, so there is nothing to list. Each lobbyist page shows their disclosures verbatim.`}
      onRetry={onRetry}
      skeleton={<HeaderSkeleton />}
      backHref={HOME_PATH}
      backLabel="Back to Home"
    >
      <ListBody rows={rows} mode="all" />
    </PageState>
  );
}

interface ListBodyProps {
  rows: RevolvingDoorRow[];
  /** `confirmed` when the rows come from `revolving_door`, `all` from the fallback. */
  mode: 'confirmed' | 'all';
}

function ListBody({ rows, mode }: ListBodyProps) {
  const summary = useMemo(() => summarize(rows), [rows]);
  // The yes or no column only earns its place when some row says yes; the fallback already states that none does.
  const showFlag = mode === 'confirmed' && rows.some((row) => row.lobbies_former_employer);

  const tiles = useMemo<StatTile[]>(
    () => [
      {
        id: 'lobbyists',
        label: 'Lobbyists',
        value: count(summary.lobbyists),
        hint: 'with a matched former position',
        countUp: { to: summary.lobbyists, format: count },
      },
      {
        id: 'engagements',
        label: 'Engagements',
        value: count(summary.engagements),
        hint: 'firm and client pairs naming them',
      },
      {
        id: 'income',
        label: 'Reported income',
        value: compactMoney(summary.income),
        hint: `U.S. dollars across every issue, ${PERIOD}`,
      },
    ],
    [summary]
  );

  const title =
    mode === 'confirmed'
      ? 'Engagements where a lobbyist contacts a former employer'
      : 'Lobbyists with a disclosed former position matched by name';
  const subtitle =
    mode === 'confirmed'
      ? `The ${count(rows.length)} rows with the most reported income, ${PERIOD}, where the filings name as contacted the chamber or agency the lobbyist disclosed leaving. Income is the engagement's total in U.S. dollars across every issue, not this lobbyist's share.`
      : `No engagement in the ${PERIOD} filings names as contacted the chamber or agency a lobbyist disclosed leaving, so every lobbyist with a matched former position is listed instead, up to 200 rows. Income is the engagement's total in U.S. dollars across every issue, not this lobbyist's share.`;

  return (
    <div className="space-y-8">
      <StatTiles tiles={tiles} columns={3} />
      <RevolvingDoorTable rows={rows} title={title} subtitle={subtitle} showFlag={showFlag} />
    </div>
  );
}
