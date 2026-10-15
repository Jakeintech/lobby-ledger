import { useMemo } from 'react';
import { Link } from 'react-router';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@databricks/appkit-ui/react';
import { count, money, toNumber } from '@/lib/format';

export interface RankedRow {
  id: string;
  name: string;
  value: number;
  href: string;
}

export interface RankedBarsProps {
  /** States the message, for example `Top clients by reported income`. */
  title: string;
  rows: RankedRow[];
  unit?: 'dollars' | 'count';
  /** Unit and period note under the title. */
  subtitle?: string;
  /** Same as subtitle; kept for pages written against the earlier prop name. */
  description?: string;
  /** One sentence for when rows is empty. */
  emptyMessage?: string;
}

/**
 * A ranked list drawn as horizontal bars in HTML, so every name is a real
 * link that keyboards and screen readers reach, with the exact figure in a
 * tooltip on hover and on focus. Rank numbers stay because the list is a
 * sequence.
 */
export function RankedBars({
  title,
  rows,
  unit = 'dollars',
  subtitle,
  description,
  emptyMessage = 'No entries ranked for this page.',
}: RankedBarsProps) {
  const sorted = useMemo(() => [...rows].sort((a, b) => toNumber(b.value) - toNumber(a.value)), [rows]);
  const max = sorted.length > 0 ? Math.max(0, ...sorted.map((row) => toNumber(row.value))) : 0;
  const short = unit === 'dollars' ? (value: number) => money(value, { compact: true }) : count;
  const exact = unit === 'dollars' ? (value: number) => money(value) : count;
  const note = subtitle ?? description;

  return (
    <figure className="min-w-0">
      <figcaption className="border-t border-border pt-3">
        <p className="font-medium text-foreground">{title}</p>
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
      </figcaption>
      {sorted.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <TooltipProvider delayDuration={150}>
          <ol className="mt-3 space-y-2">
            {sorted.map((row, position) => {
              const value = toNumber(row.value);
              const width = max > 0 ? Math.max(1, Math.round((value / max) * 100)) : 0;
              const share = max > 0 ? Math.round((value / max) * 100) : 0;
              return (
                <li key={row.id} className="min-w-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        to={row.href}
                        className="group block min-w-0 rounded-sm"
                        aria-label={`${position + 1}. ${row.name}, ${exact(value)}`}
                      >
                        <span className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-baseline gap-2">
                            <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground">
                              {position + 1}
                            </span>
                            <span className="min-w-0 truncate font-medium text-primary underline-offset-4 group-hover:underline">
                              {row.name}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums text-foreground">{short(value)}</span>
                        </span>
                        <span className="ml-7 mt-1 block h-2 overflow-hidden rounded-sm bg-muted" aria-hidden="true">
                          <span
                            className="block h-full rounded-sm"
                            style={{ width: `${width}%`, backgroundColor: 'var(--ledger)' }}
                          />
                        </span>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="start">
                      {exact(value)}
                      {position > 0 && share < 100 ? `, ${share}% of the top entry` : ''}
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ol>
        </TooltipProvider>
      )}
    </figure>
  );
}
