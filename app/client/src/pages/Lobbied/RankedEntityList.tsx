import { Link } from 'react-router';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@databricks/appkit-ui/react';
import { count, money } from '@/lib/format';

export interface RankedEntityRow {
  id: string;
  name: string;
  /** Reported income in U.S. dollars; the bar length. */
  income: number;
  /** Firm and client pairs; the secondary figure. */
  engagements: number;
  href: string;
}

export interface RankedEntityListProps {
  /** States the message, for example `House offices and committees by reported income`. */
  title: string;
  /** Unit and period note under the title. */
  subtitle: string;
  /** Already sorted by income, descending. */
  rows: RankedEntityRow[];
  /** Bars scale to this figure, so lists on one page share a scale. Defaults to the first row's income. */
  max?: number;
  /** One sentence for when rows is empty. */
  emptyMessage: string;
}

/**
 * A ranked list with two figures per row: income as a ledger-blue bar with
 * the compact figure, and the engagement count after it. RankedBars carries
 * one figure, so this page-local list adds the second. Every name is a real
 * link; the exact figures are in a tooltip on hover and on focus.
 */
export function RankedEntityList({ title, subtitle, rows, max, emptyMessage }: RankedEntityListProps) {
  const top = max ?? (rows.length > 0 ? Math.max(0, ...rows.map((row) => row.income)) : 0);
  return (
    <figure className="min-w-0">
      <figcaption className="border-t border-border pt-3">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </figcaption>
      {rows.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <TooltipProvider delayDuration={150}>
          <ol className="mt-3 space-y-2">
            {rows.map((row, position) => {
              const width = top > 0 ? Math.max(1, Math.round((row.income / top) * 100)) : 0;
              const engagements = `${count(row.engagements)} ${row.engagements === 1 ? 'engagement' : 'engagements'}`;
              return (
                <li key={row.id} className="min-w-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        to={row.href}
                        className="group block min-w-0 rounded-sm"
                        aria-label={`${position + 1}. ${row.name}, ${money(row.income)}, ${engagements}`}
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
                          <span className="shrink-0 whitespace-nowrap tabular-nums">
                            <span className="text-foreground">{money(row.income, { compact: true })}</span>
                            <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">{engagements}</span>
                          </span>
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
                      {money(row.income)}, {engagements}
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
