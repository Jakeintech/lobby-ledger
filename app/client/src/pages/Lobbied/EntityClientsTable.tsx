import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@databricks/appkit-ui/react';
import { EntityLink } from '@/components/EntityLink';
import { count, money, toNumber } from '@/lib/format';
import { SortHead } from '@/pages/Lobbyist/SortHead';
import { sortCaption, useSort } from '@/pages/Lobbyist/sort';

/** One row of `government_entity_clients`: a client whose reports named the entity. */
export interface EntityClientRow {
  client_id: string;
  client: string;
  income: number | string;
  rank: number | string;
}

type SortKey = 'rank' | 'client' | 'income';

const LABELS: Record<SortKey, string> = { rank: 'Rank', client: 'Client', income: 'Income' };

const DESC_FIRST: ReadonlyArray<SortKey> = ['income'];

function compare(a: EntityClientRow, b: EntityClientRow, key: SortKey): number {
  switch (key) {
    case 'rank':
      return toNumber(a.rank) - toNumber(b.rank);
    case 'client':
      return a.client.localeCompare(b.client);
    case 'income':
      return toNumber(a.income) - toNumber(b.income);
  }
}

/** The clients whose quarterly reports named the entity as contacted, ranked by income. Sortable by any column. */
export function EntityClientsTable({ rows, entityName }: { rows: EntityClientRow[]; entityName: string }) {
  const { sort, toggle } = useSort<SortKey>({ key: 'rank', direction: 'asc' }, DESC_FIRST);
  const sorted = useMemo(() => {
    const sign = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort(
      (a, b) =>
        sign * compare(a, b, sort.key) || toNumber(a.rank) - toNumber(b.rank) || a.client_id.localeCompare(b.client_id)
    );
  }, [rows, sort]);
  const headProps = { sort, onSort: toggle };

  return (
    <figure className="min-w-0">
      <figcaption className="border-t border-border pt-3">
        <p className="font-medium text-foreground">Clients whose reports named {entityName}, by income</p>
        <p className="text-sm text-muted-foreground">
          Income is the U.S. dollars on each client&rsquo;s reports that listed this entity as contacted, 2024 to 2025,
          across every issue those reports covered. Click a column to sort.
        </p>
      </figcaption>
      <div className="mt-3 w-full overflow-x-auto border-t border-border">
        <Table>
          <caption className="sr-only">
            {count(rows.length)} clients, {sortCaption(sort, LABELS)}.
          </caption>
          <TableHeader>
            <TableRow>
              <SortHead sortKey="rank" label={LABELS.rank} className="w-16" {...headProps} />
              <SortHead sortKey="client" label={LABELS.client} {...headProps} />
              <SortHead sortKey="income" label={LABELS.income} align="right" {...headProps} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => (
              <TableRow key={row.client_id}>
                <TableCell className="align-top tabular-nums text-muted-foreground">{count(row.rank)}</TableCell>
                <TableCell className="min-w-48 max-w-md whitespace-normal align-top">
                  <EntityLink kind="client" id={row.client_id} name={row.client} />
                </TableCell>
                <TableCell className="text-right align-top tabular-nums">{money(row.income)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </figure>
  );
}
