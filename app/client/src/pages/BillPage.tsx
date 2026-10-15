import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { sql } from '@databricks/appkit-ui/js';
import type { SQLStringMarker } from '@databricks/appkit-ui/js';
import { Badge, useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { EngagementTable } from '@/components/EngagementTable';
import type { EngagementRow } from '@/components/EngagementTable';
import { EntityLink } from '@/components/EntityLink';
import { PageState } from '@/components/PageState';
import { QuarterChart } from '@/components/QuarterChart';
import type { QuarterMarker } from '@/components/QuarterChart';
import { RankedBars } from '@/components/RankedBars';
import { StatTiles } from '@/components/StatTiles';
import type { StatTile } from '@/components/StatTiles';
import { billLabel, count, money, normalizeBillKey, quarterLabel, toNumber } from '@/lib/format';
import { clientPath } from '@/lib/routes';
import { usePageTitle } from '@/lib/usePageTitle';
import { HeaderSkeleton, Retryable } from '@/pages/Topic/Retryable';

/** The filing years in the data slice; every figure on the page covers this span. */
const PERIOD = '2024 to 2025';

/** How many engagements the citation ranking shows. */
const TOP_CITERS = 10;

type LookupParams = { key: SQLStringMarker };
type BillParams = { congress: SQLStringMarker; key: SQLStringMarker };

interface SectionProps {
  label: string;
  params: BillParams;
  onRetry: () => void;
}

const LINK_CLASS = 'font-medium text-primary underline-offset-4 hover:underline';

function splitCodes(codes: string | null | undefined): string[] {
  return [
    ...new Set(
      (codes ?? '')
        .split(',')
        .map((code) => code.trim())
        .filter(Boolean)
    ),
  ];
}

/** `119` becomes `119th`. */
function ordinal(n: number): string {
  const rem100 = n % 100;
  const suffix = rem100 >= 11 && rem100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

const LONG_DATE = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** `2025-07-04` becomes `July 4, 2025`; anything that is not a date passes through. */
function longDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return LONG_DATE.format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
}

/** Bill page: one bill, the filings that name it by quarter, and the engagements lobbying on it. */
export function BillPage() {
  const { key = '' } = useParams();
  const billKey = normalizeBillKey(key) ?? key.trim().toUpperCase();
  return (
    <Retryable skeleton={<HeaderSkeleton />}>
      {(retry) => <BillLookup key={billKey} billKey={billKey} onRetry={retry} />}
    </Retryable>
  );
}

/** A bill key can appear in more than one Congress; the page shows the newest one that has filings. */
function BillLookup({ billKey, onRetry }: { billKey: string; onRetry: () => void }) {
  const params = useMemo<LookupParams>(() => ({ key: sql.string(billKey) }), [billKey]);
  const lookup = useAnalyticsQuery('bill_lookup', params);
  const found = lookup.data?.[0];
  const label = billLabel(billKey);
  usePageTitle(label);
  return (
    <PageState
      loading={lookup.loading}
      error={lookup.error}
      empty={!found}
      emptyTitle={`No filings mention ${label}`}
      emptyMessage={`No quarterly report in the ${PERIOD} filings names ${label} in its specific issues. Check the bill number, or search for a client or firm.`}
      onRetry={onRetry}
      skeleton={<HeaderSkeleton />}
    >
      {found && <BillBody billKey={found.bill_key} congress={toNumber(found.congress)} onRetry={onRetry} />}
    </PageState>
  );
}

function BillBody({ billKey, congress, onRetry }: { billKey: string; congress: number; onRetry: () => void }) {
  const params = useMemo<BillParams>(
    () => ({ congress: sql.string(String(congress)), key: sql.string(billKey) }),
    [congress, billKey]
  );
  const detail = useAnalyticsQuery('bill_detail', params);
  const bill = detail.data?.[0];
  const label = bill?.bill_label ?? billLabel(billKey);

  // The quarter picked on the chart; the engagement table narrows to it.
  const [quarter, setQuarter] = useState<string | null>(null);

  const tiles = useMemo<StatTile[]>(() => {
    if (!bill) return [];
    const filings = toNumber(bill.filings_mentioning);
    return [
      {
        id: 'filings',
        label: 'Filings mentioning',
        value: count(filings),
        hint: 'quarterly reports',
        countUp: { to: filings, format: count },
      },
      {
        id: 'engagements',
        label: 'Engagements',
        value: count(bill.engagement_count),
        hint: `firm and client pairs citing ${label}`,
      },
      {
        id: 'income',
        label: 'Reported income',
        value: money(bill.income, { compact: true }),
        hint: 'by those pairs, all issues',
      },
      {
        id: 'congress',
        label: 'Congress',
        value: ordinal(toNumber(bill.congress)),
        hint: bill.is_law ? 'became law' : bill.stage?.trim() || 'stage unknown',
      },
    ];
  }, [bill, label]);

  const introduced = longDate(bill?.introduced_date);
  const latestAction = longDate(bill?.latest_action_date);
  const sponsor = bill?.sponsor_name?.trim();
  const sponsorTag = [bill?.sponsor_party?.trim(), bill?.sponsor_state?.trim()].filter(Boolean).join(', ');

  return (
    <div className="space-y-10">
      <PageState
        loading={detail.loading}
        error={detail.error}
        empty={!bill}
        emptyTitle={`No filings mention ${label}`}
        emptyMessage={`No quarterly report in the ${PERIOD} filings names ${label} in its specific issues. Check the bill number, or search for a client or firm.`}
        onRetry={onRetry}
        skeleton={<HeaderSkeleton />}
      >
        {bill && (
          <header className="space-y-5">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl">{label}</h1>
              {bill.title?.trim() ? (
                <p className="text-lg text-muted-foreground">{bill.title.trim()}</p>
              ) : (
                <p className="text-muted-foreground">
                  Named on {count(bill.filings_mentioning)} quarterly reports by {count(bill.engagement_count)}{' '}
                  engagements in the {ordinal(toNumber(bill.congress))} Congress.
                </p>
              )}
              {(sponsor || introduced || latestAction) && (
                <p className="text-sm text-muted-foreground">
                  {sponsor && `Sponsored by ${sponsor}${sponsorTag ? ` (${sponsorTag})` : ''}. `}
                  {introduced && `Introduced ${introduced}. `}
                  {latestAction &&
                    `Latest action ${latestAction}${bill.latest_action_text?.trim() ? `: ${bill.latest_action_text.trim()}` : ''}`}
                </p>
              )}
              {bill.congress_url?.trim() && (
                <p className="text-sm">
                  <a href={bill.congress_url.trim()} className={LINK_CLASS} rel="noreferrer">
                    Read the bill on Congress.gov
                  </a>
                </p>
              )}
            </div>
            <StatTiles tiles={tiles} columns={4} />
          </header>
        )}
      </PageState>

      {bill && (
        <>
          <Retryable>
            {(retry) => (
              <BillQuarters label={label} params={params} onRetry={retry} selected={quarter} onSelect={setQuarter} />
            )}
          </Retryable>
          <Retryable>{(retry) => <BillCiters label={label} params={params} onRetry={retry} />}</Retryable>
          <Retryable>
            {(retry) => <BillEngagements label={label} params={params} onRetry={retry} quarter={quarter} />}
          </Retryable>
        </>
      )}
    </div>
  );
}

interface BillQuartersProps extends SectionProps {
  selected: string | null;
  onSelect: (periodEndDate: string | null) => void;
}

/**
 * Filings naming the bill by quarter, with legislative milestones as amber
 * markers where Gold has them. The subtitle says when the milestone query
 * failed or returned nothing, so an empty axis is never a silent one.
 */
function BillQuarters({ label, params, onRetry, selected, onSelect }: BillQuartersProps) {
  const quarters = useAnalyticsQuery('bill_quarters', params);
  const milestones = useAnalyticsQuery('bill_milestones', params);
  const rows = useMemo(
    () =>
      (quarters.data ?? []).map((row) => ({
        period_end_date: row.period_end_date,
        value: toNumber(row.filings_mentioning),
      })),
    [quarters.data]
  );
  const markers = useMemo<QuarterMarker[]>(
    () =>
      (milestones.data ?? [])
        .filter((row) => row.milestone_date && row.milestone?.trim())
        .map((row) => ({ date: row.milestone_date, label: row.milestone.trim() })),
    [milestones.data]
  );
  const milestoneNote = milestones.loading
    ? ''
    : milestones.error
      ? ' Milestones could not be loaded.'
      : markers.length > 0
        ? ' Amber markers are legislative milestones from Congress.gov.'
        : ' No legislative milestones are loaded for this bill.';
  return (
    <PageState
      loading={quarters.loading}
      error={quarters.error}
      empty={rows.length === 0}
      emptyTitle="No quarterly figures"
      emptyMessage={`No quarterly report in the ${PERIOD} filings names ${label}, so there is nothing to chart.`}
      onRetry={onRetry}
    >
      <QuarterChart
        title={`Filings mentioning ${label} by quarter`}
        subtitle={`Quarterly reports naming ${label}, by quarter end.${milestoneNote}`}
        rows={rows}
        unit="count"
        valueLabel={`Filings naming ${label}`}
        markers={markers}
        selected={selected}
        onSelect={onSelect}
        height={280}
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
        subtitle={`Quarterly reports naming ${label}, per client and firm pair, ${PERIOD}. Each name links to the client.`}
      />
    </PageState>
  );
}

function BillEngagements({ label, params, onRetry, quarter }: SectionProps & { quarter: string | null }) {
  const { data, loading, error } = useAnalyticsQuery('bill_engagements', params);

  // The quarters column and the quarter filter follow when each pair's filings named the bill.
  const rows = useMemo<EngagementRow[]>(
    () =>
      (data ?? []).map((row) => ({
        ...row,
        first_period: row.bill_first_period || row.first_period,
        last_period: row.bill_last_period || row.last_period,
        quarters_active: toNumber(row.filings_mentioning) || row.quarters_active,
      })),
    [data]
  );
  const issueCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const row of data ?? []) for (const code of splitCodes(row.issue_codes)) codes.add(code);
    return [...codes].sort();
  }, [data]);

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          Engagements lobbying on {label}
          {quarter ? ` in ${quarterLabel(quarter)}` : ''}
        </h2>
        <p className="text-sm text-muted-foreground">
          One row per firm and client pair whose filings name {label}. Quarters show when those filings named it. Income
          is the pair&rsquo;s total in U.S. dollars across every issue it reported in {PERIOD}, not the share spent on
          this bill. Click a quarter on the chart above to narrow the list.
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
        {issueCodes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Issue codes on those filings:</span>
            {issueCodes.map((code) => (
              <Badge key={code} variant="outline" asChild>
                <EntityLink kind="topic" id={code} className="font-normal no-underline" />
              </Badge>
            ))}
          </div>
        )}
        <EngagementTable
          rows={rows}
          quarterFilter={quarter}
          emptyMessage={`No firm and client pair named ${label} in ${PERIOD}.`}
        />
      </PageState>
    </section>
  );
}
