import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@databricks/appkit-ui/react';
import { EntityLink } from '@/components/EntityLink';
import { Sparkline } from '@/components/Sparkline';
import { count, money, quarterLabel, toNumber } from '@/lib/format';
import { spanText } from '@/lib/ledger';
import { SortHead } from '@/pages/Lobbyist/SortHead';
import { sortCaption, useSort } from '@/pages/Lobbyist/sort';

/** One row of `lobbyist_engagements`: a client and firm pair that listed the lobbyist. */
export interface LobbyistEngagementRow {
  engagement_hk: string;
  client_id: string;
  client: string;
  registrant_id: string;
  firm: string;
  /** Null when the lobbyist appears only on a registration, never on a quarterly report. */
  first_period: string | null;
  last_period: string | null;
  quarters_listed: number | string;
  income_while_listed: number | string;
}

type SortKey = 'client' | 'firm' | 'quarters' | 'last' | 'income';

const LABELS: Record<SortKey, string> = {
  client: 'Client',
  firm: 'Firm',
  quarters: 'Quarters listed',
  last: 'Last listed',
  income: 'Income while listed',
};

const DESC_FIRST: ReadonlyArray<SortKey> = ['quarters', 'last', 'income'];

function compare(a: LobbyistEngagementRow, b: LobbyistEngagementRow, key: SortKey): number {
  switch (key) {
    case 'client':
      return a.client.localeCompare(b.client);
    case 'firm':
      return a.firm.localeCompare(b.firm);
    case 'quarters':
      return toNumber(a.quarters_listed) - toNumber(b.quarters_listed);
    case 'last':
      return (
        (a.last_period ?? '').localeCompare(b.last_period ?? '') ||
        (a.first_period ?? '').localeCompare(b.first_period ?? '')
      );
    case 'income':
      return toNumber(a.income_while_listed) - toNumber(b.income_while_listed);
  }
}

/**
 * Every engagement that named the lobbyist, with the quarters they were
 * listed drawn as an eight-cell strip from Q1 2024 to Q4 2025. Sortable by
 * client, firm, quarters, last quarter or income.
 */
export function EngagementTimeline({ rows, lobbyistName }: { rows: LobbyistEngagementRow[]; lobbyistName: string }) {
  const { sort, toggle } = useSort<SortKey>({ key: 'last', direction: 'desc' }, DESC_FIRST);
  const sorted = useMemo(() => {
    const sign = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort(
      (a, b) =>
        sign * compare(a, b, sort.key) ||
        toNumber(b.income_while_listed) - toNumber(a.income_while_listed) ||
        a.engagement_hk.localeCompare(b.engagement_hk)
    );
  }, [rows, sort]);
  const headProps = { sort, onSort: toggle };

  return (
    <figure className="min-w-0">
      <figcaption className="border-t border-border pt-3">
        <p className="font-medium text-foreground">Quarters {lobbyistName} was listed, by client</p>
        <p className="text-sm text-muted-foreground">
          {count(rows.length)} {rows.length === 1 ? 'engagement' : 'engagements'} named this lobbyist, 2024 to 2025.
          Each strip runs Q1 2024 to Q4 2025, left to right, and fills the quarters between the first and last report
          that listed them. Income is the U.S. dollars those reports carried, not this lobbyist&apos;s share. Click a
          column to sort.
        </p>
      </figcaption>
      <div className="mt-3 w-full overflow-x-auto border-t border-border">
        <Table>
          <caption className="sr-only">
            {count(rows.length)} engagements, {sortCaption(sort, LABELS)}.
          </caption>
          <TableHeader>
            <TableRow>
              <SortHead sortKey="client" label={LABELS.client} {...headProps} />
              <SortHead sortKey="firm" label={LABELS.firm} className="hidden md:table-cell" {...headProps} />
              <SortHead sortKey="quarters" label={LABELS.quarters} {...headProps} />
              <SortHead sortKey="last" label={LABELS.last} className="hidden lg:table-cell" {...headProps} />
              <SortHead sortKey="income" label={LABELS.income} align="right" {...headProps} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => {
              const span = spanText(row.first_period, row.last_period, quarterLabel);
              return (
                <TableRow key={row.engagement_hk}>
                  <TableCell className="max-w-64 whitespace-normal align-top sm:min-w-48">
                    <EntityLink kind="client" id={row.client_id} name={row.client} />
                  </TableCell>
                  <TableCell className="hidden max-w-56 whitespace-normal align-top md:table-cell md:min-w-40">
                    <EntityLink kind="firm" id={row.registrant_id} name={row.firm} />
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap">
                    {span ? (
                      <Sparkline first={row.first_period} last={row.last_period} label={`Listed ${span}`} />
                    ) : (
                      <span className="text-xs text-muted-foreground">Registration only</span>
                    )}
                    {span && (
                      <span className="block text-xs text-muted-foreground">
                        {count(row.quarters_listed)} {toNumber(row.quarters_listed) === 1 ? 'quarter' : 'quarters'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden align-top whitespace-nowrap lg:table-cell">
                    {row.last_period ? quarterLabel(row.last_period) : 'Never'}
                    {span && <span className="block text-xs text-muted-foreground">from {span.split(' to ')[0]}</span>}
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">{money(row.income_while_listed)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </figure>
  );
}
