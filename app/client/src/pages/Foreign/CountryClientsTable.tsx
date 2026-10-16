import { useMemo } from 'react';
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@databricks/appkit-ui/react';
import { EntityLink } from '@/components/EntityLink';
import { count, money, toNumber } from '@/lib/format';
import { SortHead } from '@/pages/Lobbyist/SortHead';
import { sortCaption, useSort } from '@/pages/Lobbyist/sort';

/** One row of `foreign_country_clients`: a client and firm pair linked to the country. */
export interface CountryClientRow {
  client_id: string;
  client: string;
  registrant_id: string;
  firm: string;
  income: number | string;
  /** Comma separated, as `array_join` wrote it; null when the link is the client's own country. */
  foreign_entity_names: string | null;
  /** Comma separated, for example `TRD, TAX`. */
  issue_codes: string | null;
  rank: number | string;
}

type SortKey = 'client' | 'firm' | 'income';

const LABELS: Record<SortKey, string> = { client: 'Client', firm: 'Firm', income: 'Income' };

const DESC_FIRST: ReadonlyArray<SortKey> = ['income'];

function splitList(value: string | null): string[] {
  return [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
    ),
  ];
}

function compare(a: CountryClientRow, b: CountryClientRow, key: SortKey): number {
  switch (key) {
    case 'client':
      return a.client.localeCompare(b.client);
    case 'firm':
      return a.firm.localeCompare(b.firm);
    case 'income':
      return toNumber(a.income) - toNumber(b.income);
  }
}

/**
 * The clients linked to one country, with the firm that filed for them,
 * the foreign entities those filings named and the issue codes they listed.
 * Sortable by client, firm or income. `country` is the name to show, not the code.
 */
export function CountryClientsTable({ rows, country }: { rows: CountryClientRow[]; country: string }) {
  const { sort, toggle } = useSort<SortKey>({ key: 'income', direction: 'desc' }, DESC_FIRST);
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
        <p className="font-medium text-foreground">Clients linked to {country}, by income</p>
        <p className="text-sm text-muted-foreground">
          One row per client and firm pair, 2024 to 2025. Income is the U.S. dollars on the pair&rsquo;s linked filings.
          Foreign entities are the ones those filings named; a blank means the link is the client&rsquo;s own place of
          business. Click a column to sort.
        </p>
      </figcaption>
      <div className="mt-3 w-full overflow-x-auto border-t border-border">
        <Table>
          <caption className="sr-only">
            {count(rows.length)} clients, {sortCaption(sort, LABELS)}.
          </caption>
          <TableHeader>
            <TableRow>
              <SortHead sortKey="client" label={LABELS.client} {...headProps} />
              <SortHead sortKey="firm" label={LABELS.firm} className="hidden md:table-cell" {...headProps} />
              <TableHead className="hidden lg:table-cell">Foreign entities</TableHead>
              <TableHead className="hidden md:table-cell">Issues</TableHead>
              <SortHead sortKey="income" label={LABELS.income} align="right" {...headProps} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => {
              const entities = splitList(row.foreign_entity_names);
              return (
                <TableRow key={`${row.client_id}-${row.registrant_id}`}>
                  <TableCell className="min-w-48 max-w-64 whitespace-normal align-top">
                    <EntityLink kind="client" id={row.client_id} name={row.client} />
                  </TableCell>
                  <TableCell className="hidden min-w-40 max-w-56 whitespace-normal align-top md:table-cell">
                    <EntityLink kind="firm" id={row.registrant_id} name={row.firm} />
                  </TableCell>
                  <TableCell className="hidden max-w-md whitespace-normal align-top text-sm lg:table-cell">
                    {entities.length === 0 ? (
                      <span className="text-muted-foreground">None named</span>
                    ) : (
                      entities.join(', ')
                    )}
                  </TableCell>
                  <TableCell className="hidden align-top md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {splitList(row.issue_codes).map((code) => (
                        <Badge key={code} variant="outline" asChild>
                          <EntityLink kind="topic" id={code} className="font-normal no-underline" />
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">{money(row.income)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </figure>
  );
}
