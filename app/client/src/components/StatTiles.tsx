import { Link } from 'react-router';
import { Card, CardContent, cn } from '@databricks/appkit-ui/react';

export interface StatTile {
  /** Stable key, for example the issue code. */
  id: string;
  label: string;
  /** Already formatted, for example `$1.2M` or `38`. */
  value: string;
  /** Secondary line under the value, for example `142 engagements`. */
  hint?: string;
  /** When set the whole tile is a link. */
  href?: string;
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

function TileBody({ tile }: { tile: StatTile }) {
  return (
    <CardContent className="flex min-w-0 flex-col gap-1 p-4">
      <span className="line-clamp-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {tile.label}
      </span>
      <span className="truncate text-2xl font-semibold tabular-nums">{tile.value}</span>
      {tile.hint && <span className="truncate text-xs text-muted-foreground">{tile.hint}</span>}
    </CardContent>
  );
}

/** A responsive grid of headline figures. Tiles with an href link to a page. */
export function StatTiles({ tiles, columns = 4, className }: StatTilesProps) {
  return (
    <ul className={cn('grid grid-cols-2 gap-3', COLUMN_CLASSES[columns], className)}>
      {tiles.map((tile) => (
        <li key={tile.id} className="min-w-0">
          {tile.href ? (
            <Link
              to={tile.href}
              className="block rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={`${tile.label}, ${tile.value}${tile.hint ? `, ${tile.hint}` : ''}`}
            >
              <Card className="h-full py-0 motion-safe:transition-colors hover:bg-accent">
                <TileBody tile={tile} />
              </Card>
            </Link>
          ) : (
            <Card className="h-full py-0">
              <TileBody tile={tile} />
            </Card>
          )}
        </li>
      ))}
    </ul>
  );
}
