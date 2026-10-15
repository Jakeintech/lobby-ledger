import { useMemo } from 'react';
import { Link } from 'react-router';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@databricks/appkit-ui/react';
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
  description?: string;
  /** One sentence for when rows is empty. */
  emptyMessage?: string;
}

/**
 * A ranked list drawn as horizontal bars. Rendered in HTML rather than on a
 * canvas so every name is a real link that keyboards and screen readers can
 * reach, and so the list wraps cleanly at phone width.
 */
export function RankedBars({
  title,
  rows,
  unit = 'dollars',
  description,
  emptyMessage = 'No entries ranked for this page.',
}: RankedBarsProps) {
  const sorted = useMemo(() => [...rows].sort((a, b) => toNumber(b.value) - toNumber(a.value)), [rows]);
  const max = sorted.length > 0 ? Math.max(0, ...sorted.map((row) => toNumber(row.value))) : 0;
  const format = unit === 'dollars' ? (value: number) => money(value, { compact: true }) : count;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="min-w-0">
        {sorted.length === 0 ? (
          <Empty className="py-6">
            <EmptyHeader>
              <EmptyTitle>Nothing ranked</EmptyTitle>
              <EmptyDescription>{emptyMessage}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ol className="space-y-3">
            {sorted.map((row, position) => {
              const value = toNumber(row.value);
              const width = max > 0 ? Math.max(1, Math.round((value / max) * 100)) : 0;
              return (
                <li key={row.id} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground">{position + 1}</span>
                      <Link
                        to={row.href}
                        className="min-w-0 truncate font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                        title={row.name}
                      >
                        {row.name}
                      </Link>
                    </span>
                    <span className="shrink-0 tabular-nums">{format(value)}</span>
                  </div>
                  <div
                    className="ml-7 mt-1 h-2 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`${row.name}: ${format(value)}`}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${width}%`, backgroundColor: 'var(--chart-cat-1)' }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
