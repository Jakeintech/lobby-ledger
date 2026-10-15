import { useMemo } from 'react';
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@databricks/appkit-ui/react';
import { EntityLink } from '@/components/EntityLink';
import { count, money } from '@/lib/format';
import { ConfidenceMark } from '@/pages/Lobbyist/ConfidenceMark';
import { kindLabel } from '@/pages/Lobbyist/affiliation';
import { SortHead } from '@/pages/Lobbyist/SortHead';
import { sortCaption, useSort } from '@/pages/Lobbyist/sort';
import { splitCodes } from '@/pages/RevolvingDoor/rows';
import type { RevolvingDoorRow } from '@/pages/RevolvingDoor/rows';
import { useOverflows } from '@/pages/RevolvingDoor/useOverflows';

type SortKey = 'lobbyist' | 'affiliation' | 'client' | 'firm' | 'income' | 'flag';

const LABELS: Record<SortKey, string> = {
  lobbyist: 'Lobbyist',
  affiliation: 'Disclosed affiliation',
  client: 'Client',
  firm: 'Firm',
  income: 'Income',
  flag: 'Lobbies former employer',
};

const DESC_FIRST: ReadonlyArray<SortKey> = ['income', 'flag'];

function flagRank(value: boolean | null): number {
  return value === null ? -1 : value ? 1 : 0;
}

function compare(a: RevolvingDoorRow, b: RevolvingDoorRow, key: SortKey): number {
  switch (key) {
    case 'lobbyist':
      return a.full_name.localeCompare(b.full_name);
    case 'affiliation':
      return a.ref_name.localeCompare(b.ref_name) || a.kind.localeCompare(b.kind);
    case 'client':
      return a.client.localeCompare(b.client);
    case 'firm':
      return a.firm.localeCompare(b.firm);
    case 'income':
      return a.income - b.income;
    case 'flag':
      return flagRank(a.lobbies_former_employer) - flagRank(b.lobbies_former_employer);
  }
}

export interface RevolvingDoorTableProps {
  rows: RevolvingDoorRow[];
  /** States the message, for example `Engagements where a lobbyist contacts a former employer`. */
  title: string;
  /** What the rows are, with unit and period. */
  subtitle: string;
  /** Adds the yes or no column; the page sets it when the query carried the flag. */
  showFlag: boolean;
}

/**
 * One row per lobbyist, affiliation and engagement: who they are, what they
 * disclosed, who pays them now and for what. Sortable by every column but
 * the issue codes. Income sits second so the headline figure is on screen
 * at phone width; the firm, issue and flag columns hide there, the minimum
 * widths apply from sm up, and the caption says when the table scrolls.
 */
export function RevolvingDoorTable({ rows, title, subtitle, showFlag }: RevolvingDoorTableProps) {
  const { sort, toggle } = useSort<SortKey>({ key: 'income', direction: 'desc' }, DESC_FIRST);
  const sorted = useMemo(() => {
    const sign = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort(
      (a, b) =>
        sign * compare(a, b, sort.key) ||
        b.income - a.income ||
        a.full_name.localeCompare(b.full_name) ||
        a.engagement_hk.localeCompare(b.engagement_hk)
    );
  }, [rows, sort]);
  const headProps = { sort, onSort: toggle };
  const [scrollRef, scrolls] = useOverflows<HTMLDivElement>();

  return (
    <figure className="min-w-0">
      <figcaption className="border-t border-border pt-3">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">
          {subtitle} Click a column to sort.{scrolls && ' Scroll sideways for more columns.'}
        </p>
      </figcaption>
      <div ref={scrollRef} className="mt-3 w-full overflow-x-auto border-t border-border">
        <Table>
          <caption className="sr-only">
            {count(rows.length)} rows, {sortCaption(sort, LABELS)}.
          </caption>
          <TableHeader>
            <TableRow>
              <SortHead sortKey="lobbyist" label={LABELS.lobbyist} {...headProps} />
              <SortHead sortKey="income" label={LABELS.income} align="right" {...headProps} />
              <SortHead sortKey="affiliation" label={LABELS.affiliation} {...headProps} />
              <SortHead sortKey="client" label={LABELS.client} {...headProps} />
              <SortHead sortKey="firm" label={LABELS.firm} className="hidden md:table-cell" {...headProps} />
              <TableHead className="hidden lg:table-cell">Issues</TableHead>
              {showFlag && (
                <SortHead sortKey="flag" label={LABELS.flag} className="hidden md:table-cell" {...headProps} />
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => (
              <TableRow key={`${row.lobbyist_id}:${row.engagement_hk}:${row.kind}:${row.ref_name}`}>
                <TableCell className="max-w-48 whitespace-normal align-top sm:min-w-36">
                  <EntityLink kind="lobbyist" id={row.lobbyist_id} name={row.full_name} />
                </TableCell>
                <TableCell className="text-right align-top tabular-nums">{money(row.income)}</TableCell>
                <TableCell className="max-w-72 whitespace-normal align-top sm:min-w-48">
                  <span className="block text-xs text-muted-foreground">{kindLabel(row.kind)}</span>
                  <span className="block">{row.ref_name}</span>
                  {row.confidence && <ConfidenceMark confidence={row.confidence} className="mt-0.5" />}
                </TableCell>
                <TableCell className="max-w-64 whitespace-normal align-top sm:min-w-40">
                  <EntityLink kind="client" id={row.client_id} name={row.client} />
                </TableCell>
                <TableCell className="hidden max-w-56 whitespace-normal align-top md:table-cell md:min-w-40">
                  <EntityLink kind="firm" id={row.registrant_id} name={row.firm} />
                </TableCell>
                <TableCell className="hidden align-top lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {splitCodes(row.issue_codes).map((code) => (
                      <Badge key={code} variant="outline" asChild>
                        <EntityLink kind="topic" id={code} className="font-normal no-underline" />
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                {showFlag && (
                  <TableCell className="hidden align-top md:table-cell">
                    {row.lobbies_former_employer === null ? (
                      <span className="text-muted-foreground">Not recorded</span>
                    ) : row.lobbies_former_employer ? (
                      <span className="font-medium text-foreground">Yes</span>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </figure>
  );
}
