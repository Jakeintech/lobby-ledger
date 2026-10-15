import { useMemo } from 'react';
import { Badge, useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { EngagementTable } from '@/components/EngagementTable';
import type { EngagementRow } from '@/components/EngagementTable';
import { EntityLink } from '@/components/EntityLink';
import { PageState } from '@/components/PageState';
import { RankedBars } from '@/components/RankedBars';
import { quarterLabel, toNumber } from '@/lib/format';
import { clientPath } from '@/lib/routes';
import { PERIOD } from '@/pages/Bill/billText';
import type { BillParams } from '@/pages/Bill/billText';
import { splitCodes } from '@/pages/RevolvingDoor/rows';

/** How many engagements the citation ranking shows. */
const TOP_CITERS = 10;

export interface BillSectionProps {
  label: string;
  params: BillParams;
  onRetry: () => void;
}

/** The firm and client pairs whose filings name the bill most often, as a ranked list. */
export function BillCiters({ label, params, onRetry }: BillSectionProps) {
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

/** Every firm and client pair whose filings name the bill, narrowed to the quarter picked on the chart. */
export function BillEngagements({ label, params, onRetry, quarter }: BillSectionProps & { quarter: string | null }) {
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
