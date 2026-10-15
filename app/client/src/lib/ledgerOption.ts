import { buildCartesianOption } from '@databricks/appkit-ui/react';
import type { ChartUITokens } from '@databricks/appkit-ui/react';
import { escapeHtml, niceScale, prefersReducedMotion, quarterFraction, quarterOrdinal } from '@/lib/ledger';

/** Fixed grid margins so HTML laid out under the canvas lines up with the bars. */
export const LEDGER_GRID = { left: 64, right: 12 } as const;

export interface LedgerPoint {
  period_end_date: string;
  value: number;
}

export interface LedgerMarker {
  date: string;
  label: string;
}

export interface LedgerOptionInput {
  points: LedgerPoint[];
  labels: string[];
  markers: LedgerMarker[];
  seriesName: string;
  variant: 'bar' | 'line';
  interactive: boolean;
  /** Plays the entry animation. Defaults to true. */
  animate?: boolean;
  /** Keeps the value axis on whole numbers, for counts. */
  integer?: boolean;
  ui: ChartUITokens;
  /** Series colour for money. */
  ledger: string;
  /** Marker colour for milestones. */
  event: string;
  /** Exact figure, for the tooltip. */
  format: (n: number) => string;
  /** Short figure, for the axis and the change line. */
  compact: (n: number) => string;
}

type TooltipParam = { dataIndex?: unknown; seriesName?: unknown };

/** Public Sans for the tooltip, so it matches the page rather than the ECharts default. */
const TOOLTIP_FONT = 'Public Sans, ui-sans-serif, system-ui, sans-serif';

/**
 * The money datum under the axis pointer, found by series name so that the
 * marker series (also lines) are skipped whether the money series is drawn
 * as bars or as a line.
 */
function pointedIndex(params: unknown, seriesName: string): number | null {
  const list: unknown[] = Array.isArray(params) ? params : [params];
  for (const item of list) {
    if (item && typeof item === 'object') {
      const p = item as TooltipParam;
      if (typeof p.dataIndex === 'number' && p.seriesName === seriesName) return p.dataIndex;
    }
  }
  return null;
}

/** `+$120K (+12%) on the prior quarter`, or null for the first quarter. */
export function changeText(current: number, previous: number | null, compact: (n: number) => string): string | null {
  if (previous === null) return null;
  const delta = current - previous;
  if (delta === 0) return 'No change on the prior quarter';
  const sign = delta > 0 ? '+' : '-';
  const pct = previous !== 0 ? ` (${sign}${Math.round((Math.abs(delta) / Math.abs(previous)) * 100)}%)` : '';
  return `${sign}${compact(Math.abs(delta))}${pct} on the prior quarter`;
}

/**
 * The ECharts option for the ledger chart. Starts from AppKit's
 * buildCartesianOption for the theme tokens and series colour, then sets the
 * grid, axes, tooltip and series itself. Milestones are drawn as two-point
 * line series (a vertical dashed segment with an end label) because the
 * markLine component is not registered by AppKit's chart bundle.
 */
export function buildLedgerOption(input: LedgerOptionInput): Record<string, unknown> {
  const { points, labels, markers, seriesName, variant, interactive, animate = true, integer = false } = input;
  const { ui, ledger, event } = input;
  const { format, compact } = input;
  const values = points.map((p) => p.value);
  const scale = niceScale(Math.max(0, ...values), 4, { integer });
  const ordinals = points.map((p) => quarterOrdinal(p.period_end_date));
  const placed = markers.flatMap((marker, i) => {
    const slot = ordinals.indexOf(quarterOrdinal(marker.date));
    if (slot < 0) return [];
    return [{ ...marker, slot, x: slot - 0.5 + (quarterFraction(marker.date) ?? 0.5), stagger: i }];
  });

  const base = buildCartesianOption({
    xData: labels,
    yDataMap: { [seriesName]: values },
    yFields: [seriesName],
    colors: [ledger],
    showLegend: false,
    ui,
    chartType: variant,
    isTimeSeries: false,
    stacked: false,
    smooth: false,
    showSymbol: true,
    symbolSize: 6,
    interactive,
  });

  const formatter = (params: unknown): string => {
    const index = pointedIndex(params, seriesName);
    if (index === null || !points[index]) return '';
    const row = points[index];
    const change = changeText(row.value, index > 0 ? points[index - 1].value : null, compact);
    const milestones = placed.filter((m) => m.slot === index);
    return [
      `<div style="font-weight:600">${escapeHtml(labels[index])}</div>`,
      `<div style="font-variant-numeric:tabular-nums">${escapeHtml(format(row.value))}</div>`,
      change ? `<div style="color:${ui.axisLabel};font-size:12px">${escapeHtml(change)}</div>` : '',
      ...milestones.map((m) => `<div style="color:${event};font-size:12px">${escapeHtml(m.label)}</div>`),
    ].join('');
  };

  return {
    ...base,
    animation: animate && !prefersReducedMotion(),
    // A resize or a data refresh redraws in place; only the first paint animates.
    animationDurationUpdate: 0,
    grid: { ...LEDGER_GRID, top: placed.length ? 22 : 10, bottom: 6, containLabel: false },
    tooltip: {
      backgroundColor: ui.tooltipBg,
      borderColor: ui.grid,
      textStyle: { color: ui.axisTitle, fontSize: 13, fontFamily: TOOLTIP_FONT },
      trigger: 'axis',
      axisPointer: { type: variant === 'bar' ? 'shadow' : 'line' },
      formatter,
    },
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: true,
      axisLabel: { show: false },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: ui.grid } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: scale.max,
      interval: scale.interval,
      axisLabel: { color: ui.axisLabel, fontSize: 11, formatter: (v: number) => compact(v) },
      splitLine: { lineStyle: { color: ui.grid } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: seriesName,
        type: variant,
        data: values,
        color: ledger,
        barMaxWidth: 44,
        itemStyle: variant === 'bar' ? { borderRadius: [2, 2, 0, 0] } : undefined,
        showSymbol: variant === 'line' ? true : undefined,
        symbolSize: variant === 'line' ? 6 : undefined,
        triggerLineEvent: variant === 'line' && interactive ? true : undefined,
        cursor: interactive ? 'pointer' : 'default',
        z: 2,
      },
      ...placed.map((m, i) => ({
        id: `marker-${i}`,
        name: m.label,
        type: 'line',
        data: [
          [m.x, 0],
          [m.x, scale.max],
        ],
        symbol: 'none',
        silent: true,
        tooltip: { show: false },
        lineStyle: { color: event, width: 1.5, type: 'dashed' },
        // The line stays amber; the label is ink so it clears the text contrast minimum.
        endLabel: {
          show: true,
          formatter: () => m.label,
          color: ui.axisTitle,
          fontSize: 12,
          fontFamily: TOOLTIP_FONT,
          align: 'left',
          verticalAlign: 'top',
          offset: [4, m.stagger * 15 - 6],
        },
        z: 3,
      })),
    ],
  };
}
