import { useMemo, useState } from 'react';
import { Button, useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { PageState } from '@/components/PageState';
import { StatTiles } from '@/components/StatTiles';
import type { StatTile } from '@/components/StatTiles';
import { count, money, toNumber } from '@/lib/format';
import { lobbiedEntityPath } from '@/lib/routes';
import { usePageTitle } from '@/lib/usePageTitle';
import { RankedEntityList } from '@/pages/Lobbied/RankedEntityList';
import { groupEntities } from '@/pages/Lobbied/groups';
import type { EntityGroup } from '@/pages/Lobbied/groups';
import { HeaderSkeleton, Retryable } from '@/pages/Topic/Retryable';

/** The filing years in the data slice; every figure on the page covers this span. */
const PERIOD = '2024 to 2025';

/** `government_entities` takes no parameters; one shared object keeps the hook's cache key stable. */
const NO_PARAMS: Record<string, never> = {};

/** How many entities each group shows before it is expanded. */
const GROUP_ROWS = 10;

const compactMoney = (n: number) => money(n, { compact: true });

/** Lobbied page: the government entities filings report contacting, ranked within House, Senate, White House and agencies. */
export function LobbiedPage() {
  usePageTitle('Who gets lobbied');
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl">Who gets lobbied</h1>
        <p className="text-muted-foreground">
          The House, Senate, White House and agency offices that quarterly reports name as contacted, ranked by the
          income on those reports, {PERIOD}.
        </p>
      </header>
      <Retryable skeleton={<HeaderSkeleton />}>{(retry) => <LobbiedBody onRetry={retry} />}</Retryable>
    </div>
  );
}

function LobbiedBody({ onRetry }: { onRetry: () => void }) {
  const { data, loading, error } = useAnalyticsQuery('government_entities', NO_PARAMS);
  const rows = useMemo(() => data ?? [], [data]);
  const groups = useMemo(() => groupEntities(rows), [rows]);
  const scale = useMemo(() => Math.max(0, ...rows.map((row) => toNumber(row.income))), [rows]);

  const tiles = useMemo<StatTile[]>(() => {
    if (rows.length === 0) return [];
    const top = [...rows].sort((a, b) => toNumber(b.income) - toNumber(a.income))[0];
    return [
      {
        id: 'entities',
        label: 'Entities ranked',
        value: count(rows.length),
        hint: 'named as contacted on at least one report',
        countUp: { to: rows.length, format: count },
      },
      ...groups.slice(0, 2).map((group) => ({
        id: group.key,
        label: group.title,
        value: count(group.rows.length),
        hint: `${group.rows.length === 1 ? 'entity' : 'entities'} ranked; the largest carries ${compactMoney(group.rows[0]?.income ?? 0)}`,
      })),
      {
        id: 'top',
        label: 'Most lobbied',
        value: top.entity_name,
        hint: `${compactMoney(toNumber(top.income))} on reports naming it`,
        href: lobbiedEntityPath(top.entity_hk),
      },
    ];
  }, [rows, groups]);

  return (
    <PageState
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyTitle="No government entities loaded yet"
      emptyMessage={`The government entity tables are built after the main load of ${PERIOD} filings finishes, so no office can be ranked until then. Check back after the next load, or browse issue areas on Home.`}
      onRetry={onRetry}
      skeleton={<HeaderSkeleton />}
    >
      <StatTiles tiles={tiles} columns={4} />
      <p className="text-sm text-muted-foreground">
        A report that names several entities counts in full toward each of them, so these figures overlap. Bars in every
        group share one scale, so a House office and an agency compare at a glance.
      </p>
      <div className="grid gap-8 lg:grid-cols-2">
        {groups.map((group) => (
          <GroupList key={group.key} group={group} scale={scale} />
        ))}
      </div>
    </PageState>
  );
}

function GroupList({ group, scale }: { group: EntityGroup; scale: number }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? group.rows : group.rows.slice(0, GROUP_ROWS);
  const hidden = group.rows.length - shown.length;
  return (
    <div className="min-w-0">
      <RankedEntityList
        title={`${group.title}, ranked by reported income`}
        subtitle={`${group.description}. U.S. dollars on reports naming each one, with the firm and client pairs behind them, ${PERIOD}.`}
        rows={shown}
        max={scale}
        emptyMessage={`No report names a ${group.title} entity as contacted.`}
      />
      {hidden > 0 && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="mt-2 h-auto px-0 py-1"
          onClick={() => setShowAll(true)}
        >
          Show all {count(group.rows.length)} in {group.title}
        </Button>
      )}
    </div>
  );
}
