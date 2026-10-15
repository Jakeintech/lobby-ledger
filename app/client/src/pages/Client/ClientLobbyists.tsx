import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@databricks/appkit-ui/react';
import { EntityLink } from '@/components/EntityLink';
import { count, quarterLabel } from '@/lib/format';

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

function periodCell(first: string | null, last: string | null): string {
  if (!first || !last) return 'No quarterly report';
  const from = quarterLabel(first);
  const to = quarterLabel(last);
  return from === to ? from : `${from} to ${to}`;
}

/**
 * Every lobbyist named on the client's quarterly reports, ranked by how many
 * quarters they were listed. The covered position line is the former
 * government role the filing disclosed, in the filer's own words.
 */
export function ClientLobbyists({ rows, clientName }: { rows: ClientLobbyistRow[]; clientName: string }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle>Lobbyists listed on {clientName} filings</CardTitle>
        <CardDescription>
          {count(rows.length)} {rows.length === 1 ? 'lobbyist' : 'lobbyists'} named on quarterly reports, 2024 to 2025,
          with the firm that listed each one.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 px-0 pb-0">
        <div className="w-full overflow-x-auto border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lobbyist</TableHead>
                <TableHead>Firm</TableHead>
                <TableHead className="text-right">Quarters listed</TableHead>
                <TableHead className="hidden md:table-cell">Listed from and to</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const covered = coveredSummary(row.covered_positions);
                return (
                  <TableRow key={row.lobbyist_id}>
                    <TableCell className="min-w-56 max-w-72 whitespace-normal align-top">
                      <EntityLink kind="lobbyist" id={row.lobbyist_id} name={row.full_name} />
                      {covered && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={covered}>
                          Covered position: {covered}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="min-w-40 max-w-56 whitespace-normal align-top">
                      <EntityLink kind="firm" id={row.registrant_id} name={row.firm} />
                    </TableCell>
                    <TableCell className="text-right align-top tabular-nums">{count(row.quarters_listed)}</TableCell>
                    <TableCell className="hidden align-top whitespace-nowrap md:table-cell">
                      {periodCell(row.first_period, row.last_period)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
