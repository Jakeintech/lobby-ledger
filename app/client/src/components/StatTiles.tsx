import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { cn } from '@databricks/appkit-ui/react';
import { prefersReducedMotion } from '@/lib/ledger';

export interface StatTile {
  /** Stable key, for example the issue code. */
  id: string;
  /** Sentence case, for example `Reported income`. */
  label: string;
  /** Already formatted, for example `$1.2M` or `38`. */
  value: string;
  /** Secondary line under the value, for example `142 engagements`. */
  hint?: string;
  /** When set the whole tile is a link. */
  href?: string;
  /**
   * Counts up from zero to `to` once on mount, rendering `format(n)` as it
   * goes. Use on one headline figure per page. Instant under reduced motion.
   */
  countUp?: { to: number; format: (n: number) => string };
}

export interface StatTilesProps {
  tiles: StatTile[];
  /** Tiles per row at desktop width. Two per row at phone width regardless. */
  columns?: 2 | 3 | 4;
  className?: string;
}

const COLUMN_CLASSES: Record<NonNullable<StatTilesProps['columns']>, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};

const COUNT_UP_MS = 900;

/** Eases 0..1 with a fast start and a soft landing. */
function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

function useCountUp(countUp: StatTile['countUp'], fallback: string): string {
  const to = countUp?.to;
  const format = countUp?.format;
  const [animate] = useState(() => to !== undefined && to !== 0 && !prefersReducedMotion());
  const [text, setText] = useState(() => (animate && format ? format(0) : fallback));
  useEffect(() => {
    if (!animate || to === undefined || !format) return;
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / COUNT_UP_MS);
      setText(format(Math.round(to * easeOut(t))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, to, format]);
  return animate ? text : fallback;
}

function TileBody({ tile }: { tile: StatTile }) {
  const value = useCountUp(tile.countUp, tile.value);
  return (
    <div className="flex min-w-0 flex-col gap-0.5 border-l border-border pl-3">
      <span className="line-clamp-2 text-sm text-muted-foreground">{tile.label}</span>
      <span className="truncate text-2xl font-semibold tabular-nums text-foreground">{value}</span>
      {tile.hint && <span className="line-clamp-2 text-xs text-muted-foreground">{tile.hint}</span>}
    </div>
  );
}

/**
 * Headline figures in a row, each set off by a left rule rather than a card.
 * Tiles with an href link to a page; one tile may count up on load.
 */
export function StatTiles({ tiles, columns = 4, className }: StatTilesProps) {
  return (
    <ul className={cn('grid grid-cols-2 gap-x-4 gap-y-5', COLUMN_CLASSES[columns], className)}>
      {tiles.map((tile) => (
        <li key={tile.id} className="min-w-0">
          {tile.href ? (
            <Link
              to={tile.href}
              className="group block rounded-sm motion-safe:transition-colors hover:bg-accent"
              aria-label={`${tile.label}, ${tile.value}${tile.hint ? `, ${tile.hint}` : ''}`}
            >
              <TileBody tile={tile} />
            </Link>
          ) : (
            <TileBody tile={tile} />
          )}
        </li>
      ))}
    </ul>
  );
}
