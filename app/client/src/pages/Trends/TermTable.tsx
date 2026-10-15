import { useMemo } from 'react';
import { Link } from 'react-router';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@databricks/appkit-ui/react';
import { count, money, quarterLabel, toNumber } from '@/lib/format';
import { spanText } from '@/lib/ledger';
import { trendPath } from '@/lib/routes';
import { SortHead } from '@/pages/Bills/SortHead';
import { sortNote, useSortState } from '@/pages/Bills/sort';
import { termDisplay } from '@/pages/Trends/termDisplay';
import { LINK_CLASS } from '@/components/EntityLink';

/** One row of `gold.term`: a curated phrase and its totals over the slice. */
export interface TermRow {
  term: string;
  filings_mentioning: number | string;
  engagement_count: number | string;
  income: number | string;
  first_period: string | null;
  last_period: string | null;
}

type SortKey = 'term' | 'filings' | 'engagements' | 'income';

const LABELS: Record<SortKey, string> = {
  term: 'Term',
  filings: 'Filings',
  engagements: 'Engagements',
  income: 'Income',
};

const FIGURES: ReadonlyArray<SortKey> = ['filings', 'engagements', 'income'];

function compare(a: TermRow, b: TermRow, key: SortKey): number {
  switch (key) {
    case 'term':
      return a.term.localeCompare(b.term);
    case 'filings':
      return toNumber(a.filings_mentioning) - toNumber(b.filings_mentioning);
    case 'engagements':
      return toNumber(a.engagement_count) - toNumber(b.engagement_count);
    case 'income':
      return toNumber(a.income) - toNumber(b.income);
  }
}

export interface TermTableProps {
  rows: TermRow[];
  emptyMessage: string;
}

/** True when no filing in the data mentions the term. */
function unmentioned(row: TermRow): boolean {
  return toNumber(row.filings_mentioning) === 0;
}

/**
 * The tracked terms with sortable columns; each term links to its trend
 * page. Terms no filing mentions sit under the ranked rows whatever the
 * sort, with a line saying so, so the ranking stays readable.
 */
export function TermTable({ rows, emptyMessage }: TermTableProps) {
  const [sort, onSort] = useSortState<SortKey>({ key: 'income', direction: 'desc' }, FIGURES);
  const { ranked, unranked } = useMemo(() => {
    const sign = sort.direction === 'asc' ? 1 : -1;
    const sorted = [...rows].sort((a, b) => sign * compare(a, b, sort.key) || a.term.localeCompare(b.term));
    return {
      ranked: sorted.filter((row) => !unmentioned(row)),
      unranked: sorted.filter(unmentioned).sort((a, b) => a.term.localeCompare(b.term)),
    };
  }, [rows, sort]);

  if (rows.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const headProps = { sort, onSort };
  const renderRow = (row: TermRow) => (
    <TableRow key={row.term}>
      <TableCell className="align-top">
        <Link to={trendPath(row.term)} className={LINK_CLASS}>
          {termDisplay(row.term)}
        </Link>
      </TableCell>
      <TableCell className="text-right align-top tabular-nums">{count(row.filings_mentioning)}</TableCell>
      <TableCell className="hidden text-right align-top tabular-nums sm:table-cell">
        {count(row.engagement_count)}
      </TableCell>
      <TableCell className="text-right align-top tabular-nums">{money(row.income)}</TableCell>
      <TableCell className="hidden align-top whitespace-nowrap md:table-cell">
        {spanText(row.first_period, row.last_period, quarterLabel) ?? 'None'}
      </TableCell>
    </TableRow>
  );
  return (
    <div className="w-full border-t border-border">
      <p className="py-2 text-sm text-muted-foreground" aria-live="polite">
        {count(ranked.length)} {ranked.length === 1 ? 'term' : 'terms'} mentioned, {sortNote(sort, LABELS)}
        {unranked.length > 0 && `; ${count(unranked.length)} not yet mentioned, listed last`}.
      </p>
      <div className="w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead sortKey="term" label={LABELS.term} {...headProps} />
              <SortHead sortKey="filings" label={LABELS.filings} {...headProps} className="text-right" />
              <SortHead
                sortKey="engagements"
                label={LABELS.engagements}
                {...headProps}
                className="hidden text-right sm:table-cell"
              />
              <SortHead sortKey="income" label={LABELS.income} {...headProps} className="text-right" />
              <TableHead className="hidden md:table-cell">Quarters mentioned</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranked.map(renderRow)}
            {unranked.length > 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="py-3 text-sm text-muted-foreground">
                  No filing mentions these {count(unranked.length)} terms yet. Their counts are built after the filings
                  load.
                </TableCell>
              </TableRow>
            )}
            {unranked.map(renderRow)}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
