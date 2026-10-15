import { useMemo, useState } from 'react';
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from '@databricks/appkit-ui/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { EntityLink } from '@/components/EntityLink';
import { Sparkline } from '@/components/Sparkline';
import { count, money, quarterLabel, toNumber } from '@/lib/format';
import { spanIncludes } from '@/lib/ledger';

/** One row of `gold.engagement`: a registrant and client pair over 2024 to 2025. */
export interface EngagementRow {
  engagement_hk: string;
  client_id: string;
  client: string;
  client_description: string | null;
  registrant_id: string;
  firm: string;
  /** Comma separated, for example `EDU, TAX`. */
  issue_codes: string | null;
  bill_labels: string | null;
  government_entities: string | null;
  /** Decimal values arrive from the warehouse as numbers or decimal strings. */
  total_income: number | string;
  first_period: string;
  last_period: string;
  quarters_active: number | string;
  /** `active` or `lapsed`. */
  engagement_status: string;
  ai_summary: string | null;
}

export type EngagementSortKey = 'client' | 'firm' | 'income' | 'last';

export interface EngagementTableProps {
  rows: EngagementRow[];
  /** One sentence for when there are no rows at all. */
  emptyMessage?: string;
  /** Column to leave out when the page is already about that entity. */
  hide?: 'client' | 'firm';
  /** A quarter end date; keeps only rows whose first to last span includes that quarter. */
  quarterFilter?: string | null;
  /** Per-quarter income per engagement, keyed by `engagement_hk`, for the sparkline bars. */
  quarterValues?: Record<string, ReadonlyArray<number>>;
  defaultSort?: { key: EngagementSortKey; direction: 'asc' | 'desc' };
}

const SORT_LABELS: Record<EngagementSortKey, string> = {
  client: 'Client',
  firm: 'Firm',
  income: 'Income',
  last: 'Last quarter',
};

function splitCodes(codes: string | null): string[] {
  return [
    ...new Set(
      (codes ?? '')
        .split(',')
        .map((code) => code.trim())
        .filter(Boolean)
    ),
  ];
}

function compare(a: EngagementRow, b: EngagementRow, key: EngagementSortKey): number {
  switch (key) {
    case 'client':
      return a.client.localeCompare(b.client);
    case 'firm':
      return a.firm.localeCompare(b.firm);
    case 'income':
      return toNumber(a.total_income) - toNumber(b.total_income);
    case 'last':
      return a.last_period.localeCompare(b.last_period) || a.first_period.localeCompare(b.first_period);
  }
}

interface SortHeadProps {
  sortKey: EngagementSortKey;
  active: EngagementSortKey;
  direction: 'asc' | 'desc';
  onSort: (key: EngagementSortKey) => void;
  className?: string;
}

function SortHead({ sortKey, active, direction, onSort, className }: SortHeadProps) {
  const isActive = sortKey === active;
  const Icon = direction === 'asc' ? ChevronUp : ChevronDown;
  return (
    <TableHead aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'} className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 rounded-sm font-medium hover:text-foreground',
          isActive ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {SORT_LABELS[sortKey]}
        <Icon className={cn('size-3.5', !isActive && 'invisible')} aria-hidden="true" />
      </button>
    </TableHead>
  );
}

/**
 * Engagements with sortable columns, an eight-quarter sparkline per row and
 * the AI summary where one exists. On a phone the issue, period and summary
 * columns hide and the table scrolls inside its own container.
 *
 * The quarter filter is span based (first to last reported quarter) because
 * no query yet returns income per engagement per quarter; the selected cell
 * in each sparkline shows why a row is kept. True per-quarter filtering and
 * bar sparklines need an engagement_quarter query in config/.
 */
export function EngagementTable({
  rows,
  emptyMessage = 'No engagements reported for this page.',
  hide,
  quarterFilter = null,
  quarterValues,
  defaultSort = { key: 'income', direction: 'desc' },
}: EngagementTableProps) {
  const [sort, setSort] = useState(defaultSort);

  function onSort(key: EngagementSortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'income' || key === 'last' ? 'desc' : 'asc' }
    );
  }

  const shown = useMemo(() => {
    const kept = quarterFilter ? rows.filter((r) => spanIncludes(r.first_period, r.last_period, quarterFilter)) : rows;
    const sign = sort.direction === 'asc' ? 1 : -1;
    return [...kept].sort((a, b) => sign * compare(a, b, sort.key) || a.engagement_hk.localeCompare(b.engagement_hk));
  }, [rows, quarterFilter, sort]);

  if (rows.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  if (shown.length === 0 && quarterFilter) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        No engagement in this list reported in {quarterLabel(quarterFilter)}. Choose another quarter or show all
        quarters.
      </p>
    );
  }

  const headProps = { active: sort.key, direction: sort.direction, onSort };
  const sortNote = `sorted by ${SORT_LABELS[sort.key].toLowerCase()} ${sort.direction === 'asc' ? 'ascending' : 'descending'}`;
  const filterNote = quarterFilter
    ? shown.length === rows.length
      ? `Every engagement in this list was active in ${quarterLabel(quarterFilter)}`
      : `${count(shown.length)} of ${count(rows.length)} engagements active in ${quarterLabel(quarterFilter)}`
    : `${count(rows.length)} ${rows.length === 1 ? 'engagement' : 'engagements'}`;

  return (
    <div className="w-full border-t border-border">
      <p className="py-2 text-sm text-muted-foreground" aria-live="polite">
        {filterNote}, {sortNote}.
      </p>
      <div className="w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {hide !== 'client' && <SortHead sortKey="client" {...headProps} />}
              {hide !== 'firm' && <SortHead sortKey="firm" {...headProps} />}
              <TableHead className="hidden md:table-cell">Issues</TableHead>
              <TableHead>Quarters</TableHead>
              <SortHead sortKey="income" {...headProps} className="text-right" />
              <SortHead sortKey="last" {...headProps} className="hidden lg:table-cell" />
              <TableHead className="hidden md:table-cell">Summary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((row) => (
              <TableRow key={row.engagement_hk}>
                {hide !== 'client' && (
                  <TableCell className="max-w-56 whitespace-normal align-top">
                    <EntityLink kind="client" id={row.client_id} name={row.client} />
                  </TableCell>
                )}
                {hide !== 'firm' && (
                  <TableCell className="max-w-56 whitespace-normal align-top">
                    <EntityLink kind="firm" id={row.registrant_id} name={row.firm} />
                  </TableCell>
                )}
                <TableCell className="hidden align-top md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {splitCodes(row.issue_codes).map((code) => (
                      <Badge key={code} variant="outline" asChild>
                        <EntityLink kind="topic" id={code} className="font-normal no-underline" />
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <Sparkline
                    first={row.first_period}
                    last={row.last_period}
                    values={quarterValues?.[row.engagement_hk]}
                    selectedQuarter={quarterFilter}
                  />
                  <span className="block text-xs text-muted-foreground">{count(row.quarters_active)} reported</span>
                </TableCell>
                <TableCell className="text-right align-top tabular-nums">{money(row.total_income)}</TableCell>
                <TableCell className="hidden align-top whitespace-nowrap lg:table-cell">
                  {quarterLabel(row.last_period)}
                  <span className="block text-xs text-muted-foreground">
                    {row.engagement_status === 'active' ? 'Active' : 'Lapsed'}, from {quarterLabel(row.first_period)}
                  </span>
                </TableCell>
                <TableCell className="hidden max-w-md whitespace-normal align-top text-sm text-muted-foreground md:table-cell">
                  {row.ai_summary ?? 'No summary yet.'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
