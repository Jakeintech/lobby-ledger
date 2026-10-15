import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@databricks/appkit-ui/react';
import { EntityLink } from '@/components/EntityLink';
import { Sparkline } from '@/components/Sparkline';
import { count, quarterLabel, toNumber } from '@/lib/format';
import { spanText } from '@/lib/ledger';
import { SortHead } from '@/pages/Lobbyist/SortHead';
import { sortCaption, useSort } from '@/pages/Lobbyist/sort';

/** One row of `client_lobbyists`: a lobbyist and the firm that listed them on this client's filings. */
export interface ClientLobbyistRow {
  lobbyist_id: string;
  full_name: string;
  /** Distinct covered positions joined with ` | `, or null when none were disclosed. */
  covered_positions: string | null;
  firm: string;
  registrant_id: string;
  first_period: string | null;
  last_period: string | null;
  quarters_listed: number | string;
}

type SortKey = 'lobbyist' | 'firm' | 'quarters' | 'last';

const LABELS: Record<SortKey, string> = {
  lobbyist: 'Lobbyist',
  firm: 'Firm',
  quarters: 'Quarters listed',
  last: 'Listed',
};

const DESC_FIRST: ReadonlyArray<SortKey> = ['quarters', 'last'];

/**
 * The filings repeat a position on every report, sometimes with and sometimes
 * without a final full stop, so dedupe on the text with trailing punctuation
 * removed and keep the longest spelling.
 */
function coveredSummary(positions: string | null): string {
  const byKey = new Map<string, string>();
  for (const part of (positions ?? '').split(' | ')) {
    const text = part.trim();
    if (!text) continue;
    const key = text.replace(/[\s.;,]+$/, '').toLowerCase();
    const existing = byKey.get(key);
    if (!existing || text.length > existing.length) byKey.set(key, text);
  }
  return [...byKey.values()].join(' | ');
}

function compare(a: ClientLobbyistRow, b: ClientLobbyistRow, key: SortKey): number {
  switch (key) {
    case 'lobbyist':
      return a.full_name.localeCompare(b.full_name);
    case 'firm':
      return a.firm.localeCompare(b.firm);
    case 'quarters':
      return toNumber(a.quarters_listed) - toNumber(b.quarters_listed);
    case 'last':
      return (
        (a.last_period ?? '').localeCompare(b.last_period ?? '') ||
        (a.first_period ?? '').localeCompare(b.first_period ?? '')
      );
  }
}

/**
 * Every lobbyist named on the client's quarterly reports, sortable by name,
 * firm, quarters listed or the last quarter they appeared. The eight-cell
 * strip shows which quarters that was; the covered position line is the
 * former government role the filing disclosed, in the filer's own words.
 */
export function ClientLobbyists({ rows, clientName }: { rows: ClientLobbyistRow[]; clientName: string }) {
  const { sort, toggle } = useSort<SortKey>({ key: 'quarters', direction: 'desc' }, DESC_FIRST);
  const sorted = useMemo(() => {
    const sign = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => sign * compare(a, b, sort.key) || a.lobbyist_id.localeCompare(b.lobbyist_id));
  }, [rows, sort]);
  const headProps = { sort, onSort: toggle };

  return (
    <figure className="min-w-0">
      <figcaption className="border-t border-border pt-3">
        <p className="font-medium text-foreground">Lobbyists listed on {clientName} filings</p>
        <p className="text-sm text-muted-foreground">
          {count(rows.length)} {rows.length === 1 ? 'lobbyist' : 'lobbyists'} named on quarterly reports, 2024 to 2025,
          with the firm that listed each one. Click a column to sort.
        </p>
      </figcaption>
      <div className="mt-3 w-full overflow-x-auto border-t border-border">
        <Table>
          <caption className="sr-only">
            {count(rows.length)} lobbyists, {sortCaption(sort, LABELS)}.
          </caption>
          <TableHeader>
            <TableRow>
              <SortHead sortKey="lobbyist" label={LABELS.lobbyist} {...headProps} />
              <SortHead sortKey="firm" label={LABELS.firm} {...headProps} />
              <SortHead sortKey="quarters" label={LABELS.quarters} align="right" {...headProps} />
              <SortHead sortKey="last" label={LABELS.last} {...headProps} />
              <TableHead className="hidden md:table-cell">Covered position</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => {
              const covered = coveredSummary(row.covered_positions);
              const span = spanText(row.first_period, row.last_period, quarterLabel);
              return (
                <TableRow key={row.lobbyist_id}>
                  <TableCell className="min-w-48 max-w-72 whitespace-normal align-top">
                    <EntityLink kind="lobbyist" id={row.lobbyist_id} name={row.full_name} />
                  </TableCell>
                  <TableCell className="min-w-40 max-w-56 whitespace-normal align-top">
                    <EntityLink kind="firm" id={row.registrant_id} name={row.firm} />
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">{count(row.quarters_listed)}</TableCell>
                  <TableCell className="align-top whitespace-nowrap">
                    {span ? (
                      <>
                        <Sparkline first={row.first_period} last={row.last_period} label={`Listed ${span}`} />
                        <span className="block text-xs text-muted-foreground">{span}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Registration only</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden max-w-md whitespace-normal align-top text-sm text-muted-foreground md:table-cell">
                    {covered || 'None disclosed'}
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
