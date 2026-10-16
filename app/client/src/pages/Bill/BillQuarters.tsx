import { useMemo } from 'react';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { PageState } from '@/components/PageState';
import { QuarterChart } from '@/components/QuarterChart';
import type { QuarterMarker } from '@/components/QuarterChart';
import { toNumber } from '@/lib/format';
import { padQuarters } from '@/lib/ledger';
import { PERIOD, milestoneName } from '@/pages/Bill/billText';
import type { BillParams } from '@/pages/Bill/billText';

export interface BillQuartersProps {
  label: string;
  params: BillParams;
  onRetry: () => void;
  selected: string | null;
  onSelect: (periodEndDate: string | null) => void;
}

/**
 * Filings naming the bill by quarter, with legislative milestones as amber
 * markers where Gold has them. The query returns no row for a quarter with
 * no mention, so the rows are padded over the eight quarters before they
 * are charted. The subtitle says when the milestone query failed or
 * returned nothing, so an empty axis is never a silent one.
 */
export function BillQuarters({ label, params, onRetry, selected, onSelect }: BillQuartersProps) {
  const quarters = useAnalyticsQuery('bill_quarters', params);
  const milestones = useAnalyticsQuery('bill_milestones', params);
  const rows = useMemo(
    () =>
      padQuarters(
        quarters.data ?? [],
        (row) => row.period_end_date,
        (row) => toNumber(row.filings_mentioning)
      ),
    [quarters.data]
  );
  const markers = useMemo<QuarterMarker[]>(
    () =>
      (milestones.data ?? [])
        .filter((row) => row.milestone_date && row.milestone?.trim())
        .map((row) => ({ date: row.milestone_date, label: milestoneName(row.milestone) })),
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
      empty={(quarters.data ?? []).length === 0}
      emptyTitle="No quarterly figures"
      emptyMessage={`No quarterly report in the ${PERIOD} filings names ${label}, so there is nothing to chart.`}
      onRetry={onRetry}
    >
      <QuarterChart
        title={`Filings mentioning ${label} by quarter`}
        subtitle={`Quarterly reports naming ${label}, by quarter end, ${PERIOD}.${milestoneNote}`}
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
