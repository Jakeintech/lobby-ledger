import { useMemo, useState } from 'react';
import { QuarterChart } from '@/components/QuarterChart';
import { toNumber } from '@/lib/format';
import { padQuarters } from '@/lib/ledger';
import { Segmented } from '@/pages/Bills/Segmented';

/** One quarter of a term or phrase: how many filings mention it and the income on those filings. */
export interface TrendQuarterRow {
  period_end_date: string;
  filings_mentioning: number | string;
  income: number | string;
}

export type Measure = 'filings' | 'income';

const MEASURES: ReadonlyArray<{ value: Measure; label: string }> = [
  { value: 'filings', label: 'Filings' },
  { value: 'income', label: 'Income' },
];

export interface TrendChartProps {
  /** The phrase, already quoted, for example `“tariff”`. */
  subject: string;
  rows: TrendQuarterRow[];
  height?: number;
}

/**
 * The ledger for a phrase: filings mentioning it by quarter, with a toggle
 * to the reported income on those filings. The toggle sits above the chart
 * so the title can change with it and still state the message. The queries
 * return no row for a quarter with no mention, so the rows are padded over
 * the eight quarters and a quarter without mentions draws as a gap.
 */
export function TrendChart({ subject, rows, height = 280 }: TrendChartProps) {
  const [measure, setMeasure] = useState<Measure>('filings');
  const chartRows = useMemo(
    () =>
      padQuarters(
        rows,
        (row) => row.period_end_date,
        (row) => toNumber(measure === 'filings' ? row.filings_mentioning : row.income)
      ),
    [rows, measure]
  );
  const title =
    measure === 'filings'
      ? `Filings mentioning ${subject} by quarter`
      : `Reported income on filings mentioning ${subject} by quarter`;
  const subtitle =
    measure === 'filings'
      ? `Quarterly reports whose specific issues text contains ${subject}, by quarter end, 2024 to 2025.`
      : `U.S. dollars reported on quarterly reports whose text contains ${subject}, by quarter end, 2024 to 2025. Each filing counts once.`;
  return (
    <div className="space-y-3">
      <Segmented label="Measure" options={MEASURES} value={measure} onChange={setMeasure} />
      <QuarterChart
        title={title}
        subtitle={subtitle}
        rows={chartRows}
        unit={measure === 'filings' ? 'count' : 'dollars'}
        valueLabel={measure === 'filings' ? 'Filings' : 'Reported income'}
        height={height}
      />
    </div>
  );
}
