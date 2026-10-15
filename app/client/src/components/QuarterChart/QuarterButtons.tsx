import { cn } from '@databricks/appkit-ui/react';
import { LEDGER_GRID } from '@/lib/ledgerOption';

export interface QuarterPoint {
  period_end_date: string;
  value: number;
}

export interface QuarterButtonsProps {
  points: QuarterPoint[];
  labels: string[];
  selected: string | null;
  onSelect?: (periodEndDate: string | null) => void;
  format: (n: number) => string;
}

/** The x-axis, drawn in HTML so every quarter is a real button for keyboards and screen readers. */
export function QuarterButtons({ points, labels, selected, onSelect, format }: QuarterButtonsProps) {
  return (
    <div
      role="group"
      aria-label={onSelect ? 'Select a quarter' : 'Quarters'}
      className="grid"
      style={{
        paddingLeft: LEDGER_GRID.left,
        paddingRight: LEDGER_GRID.right,
        gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`,
      }}
    >
      {points.map((row, i) => {
        const [q, year] = labels[i].split(' ');
        const isSelected = selected === row.period_end_date;
        const showYear = i === 0 || q === 'Q1';
        const className = cn(
          'flex min-w-0 flex-col items-center rounded-sm py-1 text-xs leading-tight',
          isSelected ? 'font-semibold text-foreground' : 'text-muted-foreground'
        );
        const body = (
          <>
            <span className={cn(isSelected && 'underline decoration-2 underline-offset-4')}>{q}</span>
            <span className={cn('text-[10px]', !showYear && 'invisible')}>{year}</span>
          </>
        );
        return onSelect ? (
          <button
            key={row.period_end_date}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${labels[i]}, ${format(row.value)}`}
            onClick={() => onSelect(isSelected ? null : row.period_end_date)}
            className={cn(className, 'hover:text-foreground')}
          >
            {body}
          </button>
        ) : (
          <span key={row.period_end_date} className={className} aria-label={labels[i]}>
            {body}
          </span>
        );
      })}
    </div>
  );
}
