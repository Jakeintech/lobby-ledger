import { quarterLabel } from '@/lib/format';
import { QUARTER_ENDS, quarterIndex, spanText } from '@/lib/ledger';

export interface SparklineProps {
  /** First quarter end the engagement reported, or null when it never did. */
  first: string | null;
  /** Last quarter end the engagement reported. */
  last: string | null;
  /** One value per quarter in {@link QUARTER_ENDS} order. Cells scale to the largest; omitted cells draw as a strip. */
  values?: ReadonlyArray<number>;
  /**
   * The quarter the page has selected. Its cell paints in the event amber
   * and the rest fade, so each row shows why it is in a filtered list.
   */
  selectedQuarter?: string | null;
  /** Accessible description. Defaults to the span, for example `Active Q1 2024 to Q3 2025`. */
  label?: string;
  className?: string;
}

const CELL = 6;
const GAP = 2;
const HEIGHT = 14;
const WIDTH = QUARTER_ENDS.length * CELL + (QUARTER_ENDS.length - 1) * GAP;

/**
 * Eight cells, one per quarter from Q1 2024 to Q4 2025, as inline SVG. Cells
 * inside the engagement's span fill in the ledger blue; with per-quarter
 * values the cells become bars scaled to the largest value.
 */
export function Sparkline({ first, last, values, selectedQuarter = null, label, className }: SparklineProps) {
  const start = quarterIndex(first);
  const end = quarterIndex(last);
  const span = start !== null && end !== null ? { start: Math.min(start, end), end: Math.max(start, end) } : null;
  const selected = quarterIndex(selectedQuarter);
  const max = values ? Math.max(0, ...values.map((v) => (Number.isFinite(v) ? v : 0))) : 0;
  const text = label ?? (span ? `Active ${spanText(first, last, quarterLabel) ?? ''}` : 'No quarterly report');

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      role="img"
      aria-label={text}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <title>{text}</title>
      {QUARTER_ENDS.map((quarterEnd, i) => {
        const inSpan = span !== null && i >= span.start && i <= span.end;
        const isSelected = selected === i;
        const value = values?.[i] ?? 0;
        const scaled = values && max > 0 ? Math.max(2, Math.round((value / max) * HEIGHT)) : HEIGHT;
        const h = inSpan ? scaled : 2;
        const fill = inSpan ? (isSelected ? 'var(--event)' : 'var(--ledger)') : 'var(--border)';
        return (
          <rect
            key={quarterEnd}
            x={i * (CELL + GAP)}
            y={HEIGHT - h}
            width={CELL}
            height={h}
            rx={1}
            fill={fill}
            opacity={selected !== null && !isSelected ? 0.6 : 1}
          />
        );
      })}
    </svg>
  );
}
