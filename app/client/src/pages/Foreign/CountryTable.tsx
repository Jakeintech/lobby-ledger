import { useMemo } from 'react';
import { Link } from 'react-router';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@databricks/appkit-ui/react';
import { count, money, toNumber } from '@/lib/format';
import { foreignCountryPath } from '@/lib/routes';
import { countryName } from '@/pages/Foreign/country';
import { SortHead } from '@/pages/Lobbyist/SortHead';
import { sortCaption, useSort } from '@/pages/Lobbyist/sort';
import { LINK_CLASS } from '@/components/EntityLink';

/** One row of `foreign_countries`: a country and its totals over 2024 to 2025. */
export interface CountryRow {
  /** The two-letter code, which the country page's URL carries. */
  country: string;
  /** The name shown everywhere; null falls back to the code. */
  country_name: string | null;
  engagement_count: number | string;
  client_count: number | string;
  foreign_entity_count: number | string;
  income: number | string;
  rank: number | string;
}

type SortKey = 'country' | 'income' | 'clients' | 'engagements' | 'entities';

const LABELS: Record<SortKey, string> = {
  country: 'Country',
  income: 'Income',
  clients: 'Clients',
  engagements: 'Engagements',
  entities: 'Foreign entities',
};

const DESC_FIRST: ReadonlyArray<SortKey> = ['income', 'clients', 'engagements', 'entities'];

function compare(a: CountryRow, b: CountryRow, key: SortKey): number {
  switch (key) {
    case 'country':
      return countryName(a).localeCompare(countryName(b));
    case 'income':
      return toNumber(a.income) - toNumber(b.income);
    case 'clients':
      return toNumber(a.client_count) - toNumber(b.client_count);
    case 'engagements':
      return toNumber(a.engagement_count) - toNumber(b.engagement_count);
    case 'entities':
      return toNumber(a.foreign_entity_count) - toNumber(b.foreign_entity_count);
  }
}

/**
 * Countries ranked by the income on filings linked to them, each a link to
 * the country page. Sortable by any column; the rank column keeps Gold's
 * order by income so a re-sort still shows where each country stands.
 */
export function CountryTable({ rows }: { rows: CountryRow[] }) {
  const { sort, toggle } = useSort<SortKey>({ key: 'income', direction: 'desc' }, DESC_FIRST);
  const sorted = useMemo(() => {
    const sign = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort(
      (a, b) =>
        sign * compare(a, b, sort.key) || toNumber(a.rank) - toNumber(b.rank) || a.country.localeCompare(b.country)
    );
  }, [rows, sort]);
  const headProps = { sort, onSort: toggle };

  return (
    <figure className="min-w-0">
      <figcaption className="border-t border-border pt-3">
        <p className="font-medium text-foreground">Countries ranked by income on foreign-linked filings</p>
        <p className="text-sm text-muted-foreground">
          U.S. dollars, 2024 to 2025. A filing is linked to a country when it lists a foreign entity from there, or when
          its client has its principal place of business there. Click a column to sort.
        </p>
      </figcaption>
      <div className="mt-3 w-full overflow-x-auto border-t border-border">
        <Table>
          <caption className="sr-only">
            {count(rows.length)} countries, {sortCaption(sort, LABELS)}.
          </caption>
          <TableHeader>
            <TableRow>
              <SortHead sortKey="country" label={LABELS.country} {...headProps} />
              <SortHead sortKey="income" label={LABELS.income} align="right" {...headProps} />
              <SortHead sortKey="clients" label={LABELS.clients} align="right" {...headProps} />
              <SortHead
                sortKey="engagements"
                label={LABELS.engagements}
                align="right"
                className="hidden md:table-cell"
                {...headProps}
              />
              <SortHead
                sortKey="entities"
                label={LABELS.entities}
                align="right"
                className="hidden md:table-cell"
                {...headProps}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => (
              <TableRow key={row.country}>
                <TableCell className="min-w-48 whitespace-normal align-top">
                  <span className="mr-2 inline-block w-6 text-right tabular-nums text-muted-foreground">
                    {count(row.rank)}
                  </span>
                  <Link to={foreignCountryPath(row.country)} className={LINK_CLASS}>
                    {countryName(row)}
                  </Link>
                </TableCell>
                <TableCell className="text-right align-top tabular-nums">{money(row.income)}</TableCell>
                <TableCell className="text-right align-top tabular-nums">{count(row.client_count)}</TableCell>
                <TableCell className="hidden text-right align-top tabular-nums md:table-cell">
                  {count(row.engagement_count)}
                </TableCell>
                <TableCell className="hidden text-right align-top tabular-nums md:table-cell">
                  {count(row.foreign_entity_count)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </figure>
  );
}
