import { useMemo } from 'react';
import { Link } from 'react-router';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@databricks/appkit-ui/react';
import { useTheme } from 'next-themes';
import { count, money, toNumber } from '@/lib/format';
import { squarify } from '@/lib/squarify';
import { useWidth } from '@/lib/useWidth';

export interface TreemapRow {
  id: string;
  name: string;
  value: number;
  href: string;
}

export interface TreemapProps {
  /** States the message, for example `TAX income by client`. */
  title: string;
  subtitle?: string;
  rows: TreemapRow[];
  unit?: 'dollars' | 'count';
  height?: number;
  /** One sentence for when rows is empty. */
  emptyMessage?: string;
}

/** White text only once the tile is mostly ledger blue; below that the ink keeps 4.5:1. */
const WHITE_TEXT_MIX = 75;

/**
 * Area by value, laid out in HTML so every tile is a real link that
 * keyboards reach. One hue: each tile mixes the ledger blue into the page
 * background by its share of the largest value. The mix starts higher on
 * the dark page, where a faint blue would vanish into the navy.
 */
export function Treemap({
  title,
  subtitle,
  rows,
  unit = 'dollars',
  height = 320,
  emptyMessage = 'Nothing to size.',
}: TreemapProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { resolvedTheme } = useTheme();
  const floor = resolvedTheme === 'dark' ? 45 : 30;
  const items = useMemo(() => rows.map((row) => ({ ...row, value: toNumber(row.value) })), [rows]);
  const tiles = useMemo(() => squarify(items, width, height), [items, width, height]);
  const max = tiles.length ? Math.max(...tiles.map((t) => t.value)) : 0;
  const short = unit === 'dollars' ? (v: number) => money(v, { compact: true }) : count;
  const exact = unit === 'dollars' ? (v: number) => money(v) : count;
  const note =
    subtitle ?? `Area is ${unit === 'dollars' ? 'reported income in U.S. dollars' : 'the count'}. Each tile is a link.`;

  return (
    <figure className="min-w-0">
      <figcaption className="border-t border-border pt-3">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{note}</p>
      </figcaption>
      {items.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <TooltipProvider delayDuration={150}>
          <div ref={ref} className="relative mt-3 w-full" style={{ height }} role="list" aria-label={title}>
            {tiles.map((tile) => {
              const share = max > 0 ? tile.value / max : 0;
              const mix = Math.round(floor + (100 - floor) * share);
              const roomy = tile.w >= 72 && tile.h >= 40;
              return (
                <Tooltip key={tile.id}>
                  <TooltipTrigger asChild>
                    <Link
                      to={tile.href}
                      role="listitem"
                      aria-label={`${tile.name}, ${exact(tile.value)}`}
                      className="absolute flex flex-col overflow-hidden rounded-sm p-1.5 text-xs leading-tight hover:brightness-110 focus-visible:z-10 focus-visible:outline-offset-[-2px]"
                      style={{
                        left: tile.x + 1,
                        top: tile.y + 1,
                        width: Math.max(0, tile.w - 2),
                        height: Math.max(0, tile.h - 2),
                        backgroundColor: `color-mix(in oklab, var(--ledger) ${mix}%, var(--background))`,
                        color: mix >= WHITE_TEXT_MIX ? '#ffffff' : 'var(--foreground)',
                      }}
                    >
                      {roomy && (
                        <>
                          <span className="line-clamp-2 font-medium">{tile.name}</span>
                          <span className="tabular-nums opacity-90">{short(tile.value)}</span>
                        </>
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start">
                    {tile.name}: {exact(tile.value)}
                    {share < 1 ? `, ${Math.round(share * 100)}% of the largest client` : ''}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      )}
    </figure>
  );
}
