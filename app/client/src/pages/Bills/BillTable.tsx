import { useMemo } from 'react';
import { Link } from 'react-router';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@databricks/appkit-ui/react';
import { count, money, toNumber } from '@/lib/format';
import { billInCongressPath } from '@/lib/routes';
import { SortHead } from '@/pages/Bills/SortHead';
import { sortNote, useSortState } from '@/pages/Bills/sort';
import { LINK_CLASS } from '@/components/EntityLink';

/** One row of `bills_top` or `bills_became_law`. Title, stage and is_law come from Congress.gov and may be null. */
export interface BillRow {
  congress: number | string;
  bill_key: string;
  bill_label: string;
  engagement_count: number | string;
  filings_mentioning: number | string;
  income: number | string;
  title: string | null;
  stage: string | null;
  is_law: boolean | null;
}

type SortKey = 'bill' | 'stage' | 'income' | 'engagements' | 'filings';

const LABELS: Record<SortKey, string> = {
  bill: 'Bill',
  stage: 'Stage',
  income: 'Income',
  engagements: 'Engagements',
  filings: 'Filings',
};

const FIGURES: ReadonlyArray<SortKey> = ['income', 'engagements', 'filings'];

/** The legislative stages in order, so sorting by stage reads as progress. */
const STAGE_ORDER: ReadonlyArray<string> = ['introduced', 'in committee', 'passed one chamber', 'passed both', 'law'];

/** `in committee` becomes `In committee`; a bill marked as law reads `Became law`; nothing loaded reads null. */
function stageText(row: Pick<BillRow, 'stage' | 'is_law'>): string | null {
  if (row.is_law) return 'Became law';
  const stage = row.stage?.trim();
  if (!stage) return null;
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

function stageRank(row: BillRow): number {
  if (row.is_law) return STAGE_ORDER.length;
  const index = STAGE_ORDER.indexOf((row.stage ?? '').trim().toLowerCase());
  return index === -1 ? -1 : index;
}

function compare(a: BillRow, b: BillRow, key: SortKey): number {
  switch (key) {
    case 'bill':
      return a.bill_label.localeCompare(b.bill_label, 'en', { numeric: true });
    case 'stage':
      return stageRank(a) - stageRank(b);
    case 'income':
      return toNumber(a.income) - toNumber(b.income);
    case 'engagements':
      return toNumber(a.engagement_count) - toNumber(b.engagement_count);
    case 'filings':
      return toNumber(a.filings_mentioning) - toNumber(b.filings_mentioning);
  }
}

export interface BillTableProps {
  rows: BillRow[];
  /** The Congress every row belongs to, for the links. */
  congress: number;
  /** One sentence for when there are no rows. */
  emptyMessage: string;
}

/**
 * Bills with sortable columns. The bill label links to the bill page; the
 * title sits under it when Congress.gov has supplied one. Income is the
 * total reported by the engagements citing the bill, across every issue
 * they lobbied on, so it is a measure of who is in the room, not of what
 * the bill cost.
 */
export function BillTable({ rows, congress, emptyMessage }: BillTableProps) {
  const [sort, onSort] = useSortState<SortKey>({ key: 'income', direction: 'desc' }, FIGURES);

  const shown = useMemo(() => {
    const sign = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => sign * compare(a, b, sort.key) || a.bill_key.localeCompare(b.bill_key));
  }, [rows, sort]);

  const detailLoaded = rows.some((row) => row.title?.trim() || stageText(row));

  if (rows.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const headProps = { sort, onSort };

  return (
    <div className="w-full border-t border-border">
      <p className="py-2 text-sm text-muted-foreground" aria-live="polite">
        {count(rows.length)} {rows.length === 1 ? 'bill' : 'bills'}, {sortNote(sort, LABELS)}.
        {!detailLoaded && ' Titles and stages come from Congress.gov and have not been loaded for this Congress yet.'}
      </p>
      <div className="w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead sortKey="bill" label={LABELS.bill} {...headProps} />
              <SortHead sortKey="stage" label={LABELS.stage} {...headProps} className="hidden sm:table-cell" />
              <SortHead sortKey="income" label={LABELS.income} {...headProps} className="text-right" />
              <SortHead sortKey="engagements" label={LABELS.engagements} {...headProps} className="text-right" />
              <SortHead sortKey="filings" label={LABELS.filings} {...headProps} className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((row) => {
              const title = row.title?.trim();
              const stage = stageText(row);
              return (
                <TableRow key={row.bill_key}>
                  <TableCell className="max-w-md whitespace-normal align-top">
                    <Link to={billInCongressPath(congress, row.bill_key)} className={LINK_CLASS}>
                      {row.bill_label}
                    </Link>
                    {title && <span className="block text-sm text-muted-foreground">{title}</span>}
                  </TableCell>
                  <TableCell className="hidden align-top sm:table-cell">
                    {stage ?? <span className="text-muted-foreground">Not loaded</span>}
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">{money(row.income)}</TableCell>
                  <TableCell className="text-right align-top tabular-nums">{count(row.engagement_count)}</TableCell>
                  <TableCell className="text-right align-top tabular-nums">{count(row.filings_mentioning)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
