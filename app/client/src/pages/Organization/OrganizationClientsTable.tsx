import { useMemo } from 'react';
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@databricks/appkit-ui/react';
import { EntityLink } from '@/components/EntityLink';
import { count, money, toNumber } from '@/lib/format';
import { SortHead } from '@/pages/Lobbyist/SortHead';
import { sortCaption, useSort } from '@/pages/Lobbyist/sort';

/** One row of `organization_clients`: a client id as one firm registered it, with that row's totals. */
export interface OrganizationClientRow {
  client_id: string;
  name: string;
  state: string | null;
  firm_count: number | string;
  /** Comma separated firm names, as `gold.client` joins them. */
  firms: string | null;
  total_income: number | string;
  quarters_active: number | string;
  issue_codes: string | null;
  lobbyist_count: number | string;
}

type SortKey = 'client' | 'income' | 'quarters' | 'lobbyists';

const LABELS: Record<SortKey, string> = {
  client: 'Client row',
  income: 'Income',
  quarters: 'Quarters active',
  lobbyists: 'Lobbyists',
};

const DESC_FIRST: ReadonlyArray<SortKey> = ['income', 'quarters', 'lobbyists'];

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

function compare(a: OrganizationClientRow, b: OrganizationClientRow, key: SortKey): number {
  switch (key) {
    case 'client':
      return a.name.localeCompare(b.name);
    case 'income':
      return toNumber(a.total_income) - toNumber(b.total_income);
    case 'quarters':
      return toNumber(a.quarters_active) - toNumber(b.quarters_active);
    case 'lobbyists':
      return toNumber(a.lobbyist_count) - toNumber(b.lobbyist_count);
  }
}

/**
 * Every client row grouped under the organization, each a link to its
 * client page, with the firm that registered it, its income, the quarters
 * it was active and the issues it listed. Sortable by name, income,
 * quarters and lobbyists.
 */
export function OrganizationClientsTable({ rows, name }: { rows: OrganizationClientRow[]; name: string }) {
  const { sort, toggle } = useSort<SortKey>({ key: 'income', direction: 'desc' }, DESC_FIRST);
  const sorted = useMemo(() => {
    const sign = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort(
      (a, b) =>
        sign * compare(a, b, sort.key) ||
        toNumber(b.total_income) - toNumber(a.total_income) ||
        a.client_id.localeCompare(b.client_id)
    );
  }, [rows, sort]);
  const headProps = { sort, onSort: toggle };

  return (
    <figure className="min-w-0">
      <figcaption className="border-t border-border pt-3">
        <p className="font-medium text-foreground">Client rows grouped under {name}</p>
        <p className="text-sm text-muted-foreground">
          {count(rows.length)} {rows.length === 1 ? 'client id' : 'client ids'}, each as one firm registered it, with
          the spelling that firm used. Income is U.S. dollars on that row&rsquo;s quarterly reports, 2024 to 2025. Click
          a column to sort.
        </p>
      </figcaption>
      <div className="mt-3 w-full overflow-x-auto border-t border-border">
        <Table>
          <caption className="sr-only">
            {count(rows.length)} client rows, {sortCaption(sort, LABELS)}.
          </caption>
          <TableHeader>
            <TableRow>
              <SortHead sortKey="client" label={LABELS.client} {...headProps} />
              <TableHead className="hidden md:table-cell">Firm</TableHead>
              <SortHead sortKey="income" label={LABELS.income} align="right" {...headProps} />
              <SortHead
                sortKey="quarters"
                label={LABELS.quarters}
                align="right"
                className="hidden sm:table-cell"
                {...headProps}
              />
              <SortHead
                sortKey="lobbyists"
                label={LABELS.lobbyists}
                align="right"
                className="hidden md:table-cell"
                {...headProps}
              />
              <TableHead className="hidden lg:table-cell">Issues</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => {
              const state = row.state?.trim();
              return (
                <TableRow key={row.client_id}>
                  <TableCell className="min-w-48 max-w-72 whitespace-normal align-top">
                    <EntityLink kind="client" id={row.client_id} name={row.name} />
                    {state && <span className="block text-xs text-muted-foreground">{state}</span>}
                  </TableCell>
                  <TableCell className="hidden max-w-64 whitespace-normal align-top text-sm md:table-cell">
                    {splitList(row.firms).join(', ') || <span className="text-muted-foreground">None named</span>}
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">{money(row.total_income)}</TableCell>
                  <TableCell className="hidden text-right align-top tabular-nums sm:table-cell">
                    {count(row.quarters_active)}
                  </TableCell>
                  <TableCell className="hidden text-right align-top tabular-nums md:table-cell">
                    {count(row.lobbyist_count)}
                  </TableCell>
                  <TableCell className="hidden align-top lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {splitList(row.issue_codes).map((code) => (
                        <Badge key={code} variant="outline" asChild>
                          <EntityLink kind="topic" id={code} className="font-normal no-underline" />
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </figure>
  );
}
