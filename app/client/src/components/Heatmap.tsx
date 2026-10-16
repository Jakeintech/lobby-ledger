import { useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { HeatmapChart, useChartUITokens, useThemeColors } from '@databricks/appkit-ui/react';
import type { ChartClickDatum } from '@databricks/appkit-ui/react';
import { count, money, quarterLabel } from '@/lib/format';
import { QUARTER_ENDS, prefersReducedMotion } from '@/lib/ledger';
import { useWidth } from '@/lib/useWidth';

export interface HeatmapRow {
  id: string;
  name: string;
  href: string;
  /** One value per quarter in `quarters` order; missing entries count as 0. */
  values: ReadonlyArray<number>;
}

export interface HeatmapProps {
  /** States the message, for example `Issue areas by quarter`. */
  title: string;
  subtitle?: string;
  rows: HeatmapRow[];
  /** Quarter end dates for the columns. Defaults to the eight quarters of 2024 to 2025. */
  quarters?: ReadonlyArray<string>;
  unit?: 'dollars' | 'count';
  /** One sentence for when rows is empty. */
  emptyMessage?: string;
}

const X_KEY = 'quarter';
const Y_KEY = 'row';
const VALUE_KEY = 'value';
const ROW_HEIGHT = 26;
/** Row labels get more room once the figure is wide enough for a desktop layout. */
const LABEL_WIDTH = { narrow: 150, wide: 220 } as const;
const WIDE_FIGURE = 640;
const CELL_MIN_WIDTH = 44;
/**
 * Below this figure width the canvas gives way to an HTML grid: the canvas
 * needs more than a phone's width for its labels and cells and so scrolled
 * sideways, and on phones it has rendered blank.
 */
const PHONE_FIGURE = 480;

/** `Q1`, `Q2` and the year, for the two-line column headers of the phone grid. */
function quarterParts(iso: string): { year: string; quarter: string } {
  const label = quarterLabel(iso);
  const match = /^(Q[1-4]) (\d{4})$/.exec(label);
  return match ? { year: match[2], quarter: match[1] } : { year: '', quarter: label };
}

interface PhoneGridProps {
  rows: HeatmapRow[];
  quarters: ReadonlyArray<string>;
  max: number;
  ramp: ReadonlyArray<string>;
  format: (value: number) => string;
  title: string;
}

/**
 * The same cells as the canvas, drawn as a table that fits a phone: a
 * truncated name per row, a year header spanning its quarters and `Q1` to
 * `Q4` beneath it, and one shaded cell per quarter. Row names are links,
 * and so is every cell, each carrying its figure for the hover title and
 * for screen readers, so the caption's promise holds at this width too.
 */
function PhoneGrid({ rows, quarters, max, ramp, format, title }: PhoneGridProps) {
  const years = useMemo(() => {
    const groups: Array<{ year: string; span: number }> = [];
    for (const quarter of quarters) {
      const { year } = quarterParts(quarter);
      const last = groups[groups.length - 1];
      if (last && last.year === year) last.span += 1;
      else groups.push({ year, span: 1 });
    }
    return groups;
  }, [quarters]);

  const cellColor = (value: number): string => {
    if (value <= 0 || max <= 0 || ramp.length === 0) return 'var(--muted)';
    const index = Math.min(ramp.length - 1, Math.floor((value / max) * ramp.length));
    return ramp[index];
  };

  return (
    <table className="mt-3 w-full table-fixed border-separate border-spacing-x-0.5 border-spacing-y-0.5 text-xs">
      <caption className="sr-only">{title}</caption>
      <thead>
        <tr>
          <td className="w-[38%]" />
          {years.map((group) => (
            <th key={group.year} scope="colgroup" colSpan={group.span} className="font-normal text-muted-foreground">
              {group.year}
            </th>
          ))}
        </tr>
        <tr>
          <td />
          {quarters.map((quarter) => (
            <th key={quarter} scope="col" className="font-normal tabular-nums text-muted-foreground">
              {quarterParts(quarter).quarter}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <th scope="row" className="truncate pr-2 text-left font-normal">
              <Link to={row.href} className="font-medium text-primary underline-offset-4 hover:underline">
                {row.name}
              </Link>
            </th>
            {quarters.map((quarter, i) => {
              const value = row.values[i] ?? 0;
              const label = `${quarterLabel(quarter)}: ${format(value)}`;
              return (
                <td key={quarter} className="p-0">
                  <Link
                    to={row.href}
                    aria-label={`${row.name}, ${label}`}
                    title={label}
                    className="block h-7 rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                    style={{ backgroundColor: cellColor(value) }}
                  />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Rows by quarter as AppKit's HeatmapChart on the sequential ledger ramp.
 * Clicking a cell opens the row's page; the list of row links after the
 * canvas gives keyboards and screen readers the same destinations. At phone
 * width the canvas gives way to {@link PhoneGrid}.
 *
 * BaseChart merges `options` shallowly, so hiding the gradient bar means
 * passing a whole visualMap (range, ramp and `show: false`) rather than a
 * patch; the hidden component still colours the cells.
 */
export function Heatmap({
  title,
  subtitle,
  rows,
  quarters = QUARTER_ENDS,
  unit = 'dollars',
  emptyMessage = 'Nothing to compare by quarter.',
}: HeatmapProps) {
  const navigate = useNavigate();
  const ui = useChartUITokens();
  const ramp = useThemeColors('sequential');
  const [ref, width] = useWidth<HTMLElement>();
  const labelWidth = width >= WIDE_FIGURE ? LABEL_WIDTH.wide : LABEL_WIDTH.narrow;
  const phone = width > 0 && width < PHONE_FIGURE;
  const labels = useMemo(() => quarters.map((q) => quarterLabel(q)), [quarters]);

  // Row names must be unique because the chart keys cells by name.
  const named = useMemo<HeatmapRow[]>(() => {
    const seen = new Set<string>();
    return rows.map((row) => {
      const name = seen.has(row.name) ? `${row.name} (${row.id})` : row.name;
      seen.add(name);
      return { ...row, name };
    });
  }, [rows]);

  const data = useMemo(
    () =>
      named.flatMap((row) =>
        labels.map((label, i) => ({ [X_KEY]: label, [Y_KEY]: row.name, [VALUE_KEY]: row.values[i] ?? 0 }))
      ),
    [named, labels]
  );
  const max = useMemo(() => Math.max(0, ...named.flatMap((row) => row.values.map((v) => v || 0))), [named]);

  const valueFormatter = useCallback(
    (value: string | number) => (unit === 'dollars' ? money(value, { compact: true }) : count(value)),
    [unit]
  );

  const options = useMemo(
    () => ({
      animation: !prefersReducedMotion(),
      animationDurationUpdate: 0,
      grid: { left: labelWidth, right: 12, top: 8, bottom: 28, containLabel: false },
      xAxis: {
        type: 'category',
        data: labels,
        splitArea: { show: false },
        axisLabel: { color: ui.axisLabel, fontSize: 11 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: ui.grid } },
      },
      yAxis: {
        type: 'category',
        data: named.map((row) => row.name),
        inverse: true,
        splitArea: { show: false },
        axisLabel: { color: ui.axisLabel, fontSize: 12, width: labelWidth - 16, overflow: 'truncate' },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: ui.grid } },
      },
      visualMap: {
        show: false,
        min: 0,
        max: max > 0 ? max : 1,
        calculable: false,
        inRange: { color: ramp.length >= 2 ? ramp : [ui.grid, ui.axisTitle] },
      },
    }),
    [labels, named, ui, labelWidth, max, ramp]
  );

  const onDataClick = useCallback(
    (datum: ChartClickDatum) => {
      const row = named.find((r) => r.name === String(datum.y));
      if (row) void navigate(row.href);
    },
    [named, navigate]
  );

  const height = Math.max(160, named.length * ROW_HEIGHT + 44);
  const note = subtitle ?? `${unit === 'dollars' ? 'U.S. dollars' : 'Count'} by quarter end. Darker is more.`;

  return (
    <figure ref={ref} className="min-w-0">
      <figcaption className="border-t border-border pt-3">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{note}</p>
      </figcaption>
      {named.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : phone ? (
        <PhoneGrid rows={named} quarters={quarters} max={max} ramp={ramp} format={valueFormatter} title={title} />
      ) : (
        <>
          <div className="mt-3 min-w-0 overflow-x-auto">
            <div style={{ minWidth: labelWidth + labels.length * CELL_MIN_WIDTH + 12 }}>
              {width > 0 && (
                <HeatmapChart
                  key={width}
                  data={data}
                  xKey={X_KEY}
                  yAxisKey={Y_KEY}
                  yKey={VALUE_KEY}
                  colorPalette="sequential"
                  valueFormatter={valueFormatter}
                  showLegend={false}
                  showLabels={false}
                  height={height}
                  options={options}
                  onDataClick={onDataClick}
                  ariaLabel={`${title}. ${note}`}
                  testId="quarter-heatmap"
                />
              )}
            </div>
          </div>
          <ul className="sr-only" aria-label="Rows in this chart">
            {named.map((row) => (
              <li key={row.id}>
                <a href={row.href} className="focus:not-sr-only focus:inline-block focus:px-1">
                  {row.name}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </figure>
  );
}
