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
import { count, money, quarterLabel } from '@/lib/format';

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

/** The eight quarter ends the data covers, in order. */
const QUARTER_ENDS = [
  '2024-03-31',
  '2024-06-30',
  '2024-09-30',
  '2024-12-31',
  '2025-03-31',
  '2025-06-30',
  '2025-09-30',
  '2025-12-31',
] as const;

/** Position of a quarter end in {@link QUARTER_ENDS}, or null when the date is missing or outside 2024 to 2025. */
function quarterIndex(iso: string | null): number | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})/.exec(iso);
  if (!match) return null;
  const index = (Number(match[1]) - 2024) * 4 + Math.ceil(Number(match[2]) / 3) - 1;
  return index >= 0 && index < QUARTER_ENDS.length ? index : null;
}

function spanLabel(first: string | null, last: string | null): string {
  if (!first || !last) return 'No quarterly report';
  const from = quarterLabel(first);
  const to = quarterLabel(last);
  return from === to ? from : `${from} to ${to}`;
}

/** Eight cells, one per quarter, filled from the first to the last quarter the lobbyist was listed. */
function Timeline({ first, last }: { first: string | null; last: string | null }) {
  const start = quarterIndex(first);
  const end = quarterIndex(last);
  const filled = start !== null && end !== null ? { start: Math.min(start, end), end: Math.max(start, end) } : null;
  const label = filled ? `Listed ${spanLabel(first, last)}` : 'Not listed on any quarterly report';
  return (
    <div className="flex gap-0.5" role="img" aria-label={label} title={label}>
      {QUARTER_ENDS.map((quarterEnd, index) => {
        const active = filled !== null && index >= filled.start && index <= filled.end;
        return (
          <span
            key={quarterEnd}
            className="h-3 w-3 rounded-sm bg-muted"
            style={active ? { backgroundColor: 'var(--chart-cat-1)' } : undefined}
          />
        );
      })}
    </div>
  );
}

/**
 * Every engagement that named the lobbyist, newest first, with the quarters
 * they were listed drawn as a strip from Q1 2024 to Q4 2025.
 */
export function EngagementTimeline({ rows, lobbyistName }: { rows: LobbyistEngagementRow[]; lobbyistName: string }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle>Quarters {lobbyistName} was listed, by client</CardTitle>
        <CardDescription>
          {count(rows.length)} {rows.length === 1 ? 'engagement' : 'engagements'} named this lobbyist, 2024 to 2025.
          Each timeline runs Q1 2024 to Q4 2025, left to right, and fills the quarters between the first and last report
          that listed them. Income is the U.S. dollars those reports carried, not this lobbyist&apos;s share.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 px-0 pb-0">
        <div className="w-full overflow-x-auto border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="hidden md:table-cell">Firm</TableHead>
                <TableHead>Timeline</TableHead>
                <TableHead className="hidden lg:table-cell">Listed from and to</TableHead>
                <TableHead className="text-right">Quarters</TableHead>
                <TableHead className="text-right">Income while listed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.engagement_hk}>
                  <TableCell className="min-w-48 max-w-64 whitespace-normal align-top">
                    <EntityLink kind="client" id={row.client_id} name={row.client} />
                  </TableCell>
                  <TableCell className="hidden min-w-40 max-w-56 whitespace-normal align-top md:table-cell">
                    <EntityLink kind="firm" id={row.registrant_id} name={row.firm} />
                  </TableCell>
                  <TableCell className="align-top">
                    <Timeline first={row.first_period} last={row.last_period} />
                  </TableCell>
                  <TableCell className="hidden align-top whitespace-nowrap lg:table-cell">
                    {spanLabel(row.first_period, row.last_period)}
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">{count(row.quarters_listed)}</TableCell>
                  <TableCell className="text-right align-top tabular-nums">{money(row.income_while_listed)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
