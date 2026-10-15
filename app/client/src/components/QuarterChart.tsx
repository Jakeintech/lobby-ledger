import { useMemo } from 'react';
import {
  BarChart,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  LineChart,
} from '@databricks/appkit-ui/react';
import { count, money, quarterLabel, toNumber } from '@/lib/format';

export interface QuarterRow {
  /** Quarter end date as ISO text, for example `2024-03-31`. */
  period_end_date: string;
  value: number;
}

export interface QuarterChartProps {
  /** States the message, for example `TAX lobbying income by quarter`. */
  title: string;
  rows: QuarterRow[];
  unit: 'dollars' | 'count';
  /** Bars by default; the Home page uses a line. */
  variant?: 'bar' | 'line';
  /** Series name shown in tooltips. Defaults to `Reported income` or `Filings`. */
  valueLabel?: string;
  /** Overrides the generated unit and period note. */
  description?: string;
  height?: number;
}

const X_KEY = 'Quarter';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The centerpiece of every page: one value per quarter end, time on the
 * x-axis, the unit on the y-axis. A row with a zero still draws, so a topic
 * with filings but no income shows a flat $0 chart rather than nothing.
 */
export function QuarterChart({
  title,
  rows,
  unit,
  variant = 'bar',
  valueLabel,
  description,
  height = 280,
}: QuarterChartProps) {
  const seriesName = valueLabel ?? (unit === 'dollars' ? 'Reported income' : 'Filings');

  const sorted = useMemo(() => [...rows].sort((a, b) => a.period_end_date.localeCompare(b.period_end_date)), [rows]);

  const data = useMemo(
    () => sorted.map((row) => ({ [X_KEY]: quarterLabel(row.period_end_date), [seriesName]: toNumber(row.value) })),
    [sorted, seriesName]
  );

  const note = useMemo(() => {
    if (description) return description;
    if (sorted.length === 0) return unit === 'dollars' ? 'U.S. dollars by quarter end.' : 'Count by quarter end.';
    const first = quarterLabel(sorted[0].period_end_date);
    const last = quarterLabel(sorted[sorted.length - 1].period_end_date);
    const span = first === last ? first : `${first} to ${last}`;
    return unit === 'dollars'
      ? `Reported income in U.S. dollars by quarter end, ${span}.`
      : `${seriesName} by quarter end, ${span}.`;
  }, [description, sorted, unit, seriesName]);

  const valueFormatter = useMemo(
    () => (value: string | number) => (unit === 'dollars' ? money(value, { compact: true }) : count(value)),
    [unit]
  );

  const options = useMemo(() => ({ animation: !prefersReducedMotion() }), []);

  const chartProps = {
    data,
    xKey: X_KEY,
    yKey: seriesName,
    height,
    showLegend: false,
    valueFormatter,
    options,
    ariaLabel: `${title}. ${note}`,
    testId: 'quarter-chart',
  };

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{note}</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        {data.length === 0 ? (
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyTitle>No quarterly figures</EmptyTitle>
              <EmptyDescription>Nothing was reported for any quarter in the data.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : variant === 'line' ? (
          <LineChart {...chartProps} orientation="vertical" smooth={false} showSymbol />
        ) : (
          <BarChart {...chartProps} orientation="vertical" />
        )}
      </CardContent>
    </Card>
  );
}
