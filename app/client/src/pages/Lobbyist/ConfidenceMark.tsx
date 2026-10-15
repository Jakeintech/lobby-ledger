import { cn } from '@databricks/appkit-ui/react';
import { confidenceLabel } from '@/pages/Lobbyist/affiliation';
import type { Confidence } from '@/pages/Lobbyist/affiliation';

const CELL = 6;
const GAP = 2;

/**
 * Two cells and a label: both filled for an exact name match, one for a
 * partial match, none when the query carries no confidence. The cells use
 * the ledger blue so the mark reads with the sparklines beside it.
 */
export function ConfidenceMark({ confidence, className }: { confidence: Confidence | null; className?: string }) {
  const filled = confidence === 'high' ? 2 : confidence === 'medium' ? 1 : 0;
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground', className)}>
      <svg
        viewBox={`0 0 ${CELL * 2 + GAP} ${CELL}`}
        width={CELL * 2 + GAP}
        height={CELL}
        aria-hidden="true"
        style={{ display: 'inline-block' }}
      >
        {[0, 1].map((i) => (
          <rect
            key={i}
            x={i * (CELL + GAP)}
            y={0}
            width={CELL}
            height={CELL}
            rx={1}
            fill={i < filled ? 'var(--ledger)' : 'var(--border)'}
          />
        ))}
      </svg>
      {confidenceLabel(confidence)}
    </span>
  );
}
