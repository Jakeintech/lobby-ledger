import { useCallback, useMemo, useState } from 'react';
import { BaseChart, Button, useChartUITokens, useThemeColors } from '@databricks/appkit-ui/react';
import type { ChartClickDatum } from '@databricks/appkit-ui/react';
import { QuarterButtons } from '@/components/QuarterChart/QuarterButtons';
import { ZoomSlider } from '@/components/QuarterChart/ZoomSlider';
import { count, money, quarterLabel, toNumber } from '@/lib/format';
import { buildLedgerOption } from '@/lib/ledgerOption';

export interface QuarterRow {
  /** Quarter end date as ISO text, for example `2024-03-31`. */
  period_end_date: string;
  value: number;
}

export interface QuarterMarker {
  /** Any ISO date; the marker is drawn inside the quarter that contains it. */
  date: string;
  label: string;
}

export interface QuarterChartProps {
  /** States the message, for example `TAX lobbying income by quarter`. */
  title: string;
  /** Unit and period note under the title. Generated from the rows when omitted. */
  subtitle?: string;
  rows: QuarterRow[];
  unit: 'dollars' | 'count';
  /** Milestones drawn as amber vertical markers on the time axis. */
  markers?: QuarterMarker[];
  /** The selected quarter end date, or null. The other bars dim while one is selected. */
  selected?: string | null;
  /** Clicking a bar, or its quarter button for keyboards, selects it; clicking again clears. */
  onSelect?: (periodEndDate: string | null) => void;
  /** Adds a range control under the chart that narrows the quarters shown. */
  zoom?: boolean;
  /** Series name in tooltips. Defaults to `Reported income` or `Filings`. */
  valueLabel?: string;
  /** Bars by default; `line` draws the same ledger as a line. */
  variant?: 'bar' | 'line';
  height?: number;
}

const X_KEY = 'Quarter';

/**
 * The interactive ledger at the centre of every page: one bar per quarter end.
 * Hover shows the exact figure, the quarter and the change on the prior
 * quarter; clicking a bar selects that quarter so the page can filter its
 * table; milestones are amber markers on the same axis; `zoom` adds a range
 * control. Rendered with BaseChart and an option from buildCartesianOption.
 * The canvas resizes in place (echarts-for-react watches its container), so
 * a width change never unmounts the plot; the HTML axis under it shares the
 * same grid margins and so stays aligned without a measured width.
 */
export function QuarterChart({
  title,
  subtitle,
  rows,
  unit,
  markers = [],
  selected = null,
  onSelect,
  zoom = false,
  valueLabel,
  variant = 'bar',
  height = 260,
}: QuarterChartProps) {
  const seriesName = valueLabel ?? (unit === 'dollars' ? 'Reported income' : 'Filings');
  const format = useCallback((n: number) => (unit === 'dollars' ? money(n) : count(n)), [unit]);
  const compact = useCallback((n: number) => (unit === 'dollars' ? money(n, { compact: true }) : count(n)), [unit]);
  const ui = useChartUITokens();
  const palette = useThemeColors('categorical');
  const ledger = palette[0];
  const event = palette[1] ?? palette[0];
  const interactive = Boolean(onSelect);

  const sorted = useMemo(
    () =>
      rows
        .map((row) => ({ period_end_date: row.period_end_date, value: toNumber(row.value) }))
        .sort((a, b) => a.period_end_date.localeCompare(b.period_end_date)),
    [rows]
  );

  const [zoomRange, setZoomRange] = useState<{ length: number; start: number; end: number } | null>(null);
  const last = Math.max(0, sorted.length - 1);
  const range = useMemo<[number, number]>(
    () => (zoomRange && zoomRange.length === sorted.length ? [zoomRange.start, zoomRange.end] : [0, last]),
    [zoomRange, sorted.length, last]
  );
  const narrowed = zoom && (range[0] > 0 || range[1] < last);
  const points = useMemo(() => (zoom ? sorted.slice(range[0], range[1] + 1) : sorted), [sorted, zoom, range]);
  const labels = useMemo(() => points.map((row) => quarterLabel(row.period_end_date)), [points]);
  const allLabels = useMemo(() => sorted.map((row) => quarterLabel(row.period_end_date)), [sorted]);
  const onZoom = useCallback(
    (next: number[]) => setZoomRange({ length: sorted.length, start: next[0] ?? 0, end: next[1] ?? last }),
    [sorted.length, last]
  );

  const note = useMemo(() => {
    if (subtitle) return subtitle;
    if (sorted.length === 0) return unit === 'dollars' ? 'U.S. dollars by quarter end.' : 'Count by quarter end.';
    const span = `${quarterLabel(sorted[0].period_end_date)} to ${quarterLabel(sorted[sorted.length - 1].period_end_date)}`;
    return unit === 'dollars' ? `U.S. dollars by quarter end, ${span}.` : `${seriesName} by quarter end, ${span}.`;
  }, [subtitle, sorted, unit, seriesName]);

  const data = useMemo(
    () => points.map((row, i) => ({ [X_KEY]: labels[i], [seriesName]: row.value })),
    [points, labels, seriesName]
  );

  const option = useMemo(
    () =>
      buildLedgerOption({
        points,
        labels,
        markers,
        seriesName,
        variant,
        interactive,
        integer: unit === 'count',
        ui,
        ledger,
        event,
        format,
        compact,
      }),
    [points, labels, markers, seriesName, variant, interactive, unit, ui, ledger, event, format, compact]
  );

  const onDataClick = useCallback(
    (datum: ChartClickDatum) => {
      const row = points[datum.dataIndex];
      if (!row || !onSelect) return;
      onSelect(selected === row.period_end_date ? null : row.period_end_date);
    },
    [points, onSelect, selected]
  );

  const selectedLabel = selected ? quarterLabel(selected) : undefined;
  const status = selectedLabel
    ? `Showing ${selectedLabel} only.`
    : narrowed
      ? `Showing ${labels[0]} to ${labels[labels.length - 1]}.`
      : interactive
        ? 'Click a quarter to filter the table.'
        : zoom
          ? 'Drag a handle to narrow the quarters shown.'
          : '';

  return (
    <figure className="min-w-0">
      <figcaption className="border-t border-border pt-3">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{note}</p>
      </figcaption>
      {sorted.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">Nothing was reported for any quarter in the data.</p>
      ) : (
        <>
          <div role="img" aria-label={`${title}. ${note}`} className="mt-3" style={{ height }}>
            <BaseChart
              data={data}
              chartType={variant}
              xKey={X_KEY}
              yKey={seriesName}
              height={height}
              showLegend={false}
              options={option}
              selected={selectedLabel}
              onDataClick={interactive ? onDataClick : undefined}
            />
          </div>
          <QuarterButtons points={points} labels={labels} selected={selected} onSelect={onSelect} format={format} />
          {zoom && sorted.length > 1 && (
            <ZoomSlider range={range} max={sorted.length - 1} allLabels={allLabels} onChange={onZoom} />
          )}
          {(interactive || zoom) && (
            <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
              {status}
              {(selectedLabel || narrowed) && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto px-1 py-0"
                  onClick={() => (selectedLabel ? onSelect?.(null) : setZoomRange(null))}
                >
                  Show all quarters
                </Button>
              )}
            </p>
          )}
        </>
      )}
    </figure>
  );
}
