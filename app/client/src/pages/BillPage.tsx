import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';
import { sql } from '@databricks/appkit-ui/js';
import type { SQLStringMarker } from '@databricks/appkit-ui/js';
import { Badge, Skeleton, useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { EngagementTable } from '@/components/EngagementTable';
import { EntityLink } from '@/components/EntityLink';
import { PageState } from '@/components/PageState';
import { QuarterChart } from '@/components/QuarterChart';
import { RankedBars } from '@/components/RankedBars';
import { StatTiles } from '@/components/StatTiles';
import { billLabel, count, normalizeBillKey, quarterLabel, toNumber } from '@/lib/format';
import { clientPath } from '@/lib/routes';
import { usePageTitle } from '@/lib/usePageTitle';

/** The filing years in the data slice; every figure on the page covers this span. */
const PERIOD = '2024 to 2025';

/** Long enough for the analytics store to drop the old request entry before a section mounts again. */
const REMOUNT_DELAY_MS = 50;

/** How many engagements the citation ranking shows. */
const TOP_CITERS = 10;

type BillParams = { key: SQLStringMarker };

interface SectionProps {
  label: string;
  params: BillParams;
  onRetry: () => void;
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

/**
 * Re-runs a section's queries on demand. The analytics hook has no refetch:
 * its request entry lives until the last subscriber unmounts and is dropped
 * one tick later, so a retry unmounts the section, waits, and mounts it again.
 */
function Retryable({ children, skeleton }: { children: (retry: () => void) => ReactNode; skeleton?: ReactNode }) {
  const [paused, setPaused] = useState(false);
  const retry = useCallback(() => setPaused(true), []);
  useEffect(() => {
    if (!paused) return;
    const timer = setTimeout(() => setPaused(false), REMOUNT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [paused]);
  if (paused) return <>{skeleton ?? <SectionSkeleton />}</>;
  return <>{children(retry)}</>;
}

function SectionSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[1, 2, 3, 4].map((n) => (
          <Skeleton key={n} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Bill page: one bill, the filings that name it by quarter, and the engagements lobbying on it. */
export function BillPage() {
  const { key = '' } = useParams();
  const billKey = normalizeBillKey(key) ?? key.trim().toUpperCase();
  return (
    <Retryable skeleton={<HeaderSkeleton />}>{(retry) => <BillBody billKey={billKey} onRetry={retry} />}</Retryable>
  );
}

function BillBody({ billKey, onRetry }: { billKey: string; onRetry: () => void }) {
  const params = useMemo<BillParams>(() => ({ key: sql.string(billKey) }), [billKey]);
  const detail = useAnalyticsQuery('bill_detail', params);
  const bill = detail.data?.[0];
  const label = bill?.bill_label ?? billLabel(billKey);
  usePageTitle(label);

  const tiles = useMemo(
    () =>
      bill
        ? [
            {
              id: 'engagements',
              label: 'Engagements',
              value: count(bill.engagement_count),
              hint: `firm and client pairs citing ${label}`,
            },
            {
              id: 'filings',
              label: 'Filings mentioning',
              value: count(bill.filings_mentioning),
              hint: `quarterly reports, ${PERIOD}`,
            },
            {
              id: 'first',
              label: 'First cited',
              value: quarterLabel(bill.first_period),
              hint: 'earliest quarter naming it',
            },
            {
              id: 'last',
              label: 'Last cited',
              value: quarterLabel(bill.last_period),
              hint: 'latest quarter naming it',
            },
          ]
        : [],
    [bill, label]
  );
  const issueCodes = useMemo(() => splitCodes(bill?.issue_codes ?? null), [bill]);

  return (
    <div className="space-y-8">
      <PageState
        loading={detail.loading}
        error={detail.error}
        empty={!bill}
        emptyTitle={`No filings mention ${label}`}
        emptyMessage={`No quarterly report in the ${PERIOD} filings names ${label} in its specific issues. Check the bill number, or search for a client or firm from Home.`}
        onRetry={onRetry}
        skeleton={<HeaderSkeleton />}
      >
        {bill && (
          <section className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">{label}</h1>
              <p className="text-muted-foreground">
                Named on {count(bill.filings_mentioning)} quarterly reports by {count(bill.engagement_count)}{' '}
                engagements, {quarterLabel(bill.first_period)} to {quarterLabel(bill.last_period)}.
              </p>
            </div>
            <StatTiles tiles={tiles} columns={4} />
            {issueCodes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Issue codes on those filings:</span>
                {issueCodes.map((code) => (
                  <Badge key={code} variant="outline" asChild>
                    <EntityLink kind="topic" id={code} className="font-normal no-underline" />
                  </Badge>
                ))}
              </div>
            )}
          </section>
        )}
      </PageState>

      {bill && (
        <>
          <Retryable>{(retry) => <BillQuarters label={label} params={params} onRetry={retry} />}</Retryable>
          <Retryable>{(retry) => <BillCiters label={label} params={params} onRetry={retry} />}</Retryable>
          <Retryable>{(retry) => <BillEngagements label={label} params={params} onRetry={retry} />}</Retryable>
        </>
      )}
    </div>
  );
}

function BillQuarters({ label, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('bill_quarters', params);
  const rows = useMemo(
    () =>
      (data ?? []).map((row) => ({ period_end_date: row.period_end_date, value: toNumber(row.filings_mentioning) })),
    [data]
  );
  return (
    <PageState
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyTitle="No quarterly figures"
      emptyMessage={`No quarterly report in the ${PERIOD} filings names ${label}, so there is nothing to chart.`}
      onRetry={onRetry}
    >
      <QuarterChart
        title={`Filings mentioning ${label} by quarter`}
        rows={rows}
        unit="count"
        valueLabel={`Filings naming ${label}`}
      />
    </PageState>
  );
}

function BillCiters({ label, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('bill_engagements', params);
  const rows = useMemo(
    () =>
      [...(data ?? [])]
        .sort((a, b) => toNumber(b.filings_mentioning) - toNumber(a.filings_mentioning))
        .slice(0, TOP_CITERS)
        .map((row) => ({
          id: row.engagement_hk,
          name: `${row.client} with ${row.firm}`,
          value: toNumber(row.filings_mentioning),
          href: clientPath(row.client_id),
        })),
    [data]
  );
  return (
    <PageState
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyTitle="No engagements"
      emptyMessage={`No firm and client pair named ${label} on a quarterly report in ${PERIOD}.`}
      onRetry={onRetry}
    >
      <RankedBars
        title={`Engagements citing ${label} most often`}
        rows={rows}
        unit="count"
        description={`Quarterly reports naming ${label}, per client and firm pair, ${PERIOD}. Each name links to the client.`}
      />
    </PageState>
  );
}

function BillEngagements({ label, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('bill_engagements', params);
  const rows = data ?? [];
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Engagements lobbying on {label}</h2>
        <p className="text-sm text-muted-foreground">
          One row per firm and client pair whose filings name {label}. Income is the pair&apos;s total in U.S. dollars
          across every issue it reported in {PERIOD}, not the share spent on this bill.
        </p>
      </div>
      <PageState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyTitle="No engagements"
        emptyMessage={`No firm and client pair named ${label} on a quarterly report in ${PERIOD}.`}
        onRetry={onRetry}
      >
        <EngagementTable rows={rows} emptyMessage={`No firm and client pair named ${label} in ${PERIOD}.`} />
      </PageState>
    </section>
  );
}
