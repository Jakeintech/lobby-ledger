import {
  Badge,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@databricks/appkit-ui/react';
import { EntityLink } from '@/components/EntityLink';
import { count, money, quarterLabel } from '@/lib/format';

/** One row of `gold.engagement`: a registrant and client pair over 2024 to 2025. */
export interface EngagementRow {
  engagement_hk: string;
  client_id: string;
  client: string;
  client_description: string | null;
  registrant_id: string;
  firm: string;
  /** Comma separated, for example `EDU, TAX`. */
  issue_codes: string | null;
  bill_labels: string | null;
  government_entities: string | null;
  /** Decimal values arrive from the warehouse as numbers or decimal strings. */
  total_income: number | string;
  first_period: string;
  last_period: string;
  quarters_active: number | string;
  /** `active` or `lapsed`. */
  engagement_status: string;
  ai_summary: string | null;
}

export interface EngagementTableProps {
  rows: EngagementRow[];
  /** One sentence for when rows is empty. */
  emptyMessage?: string;
  /** Column to leave out when the page is already about that entity. */
  hide?: 'client' | 'firm';
}

function splitCodes(codes: string | null): string[] {
  return [
    ...new Set(
      (codes ?? '')
        .split(',')
        .map((code) => code.trim())
        .filter(Boolean)
    ),
  ];
}

function StatusBadge({ status }: { status: string }) {
  const active = status === 'active';
  return (
    <Badge variant={active ? 'default' : 'secondary'} className="capitalize">
      {status}
    </Badge>
  );
}

/**
 * Engagements sorted by income, with the AI summary where one exists. On a
 * phone the issue and period columns hide and the table scrolls inside its
 * own container, so the page itself never scrolls sideways.
 */
export function EngagementTable({
  rows,
  emptyMessage = 'No engagements reported for this page.',
  hide,
}: EngagementTableProps) {
  if (rows.length === 0) {
    return (
      <Empty className="py-6">
        <EmptyHeader>
          <EmptyTitle>No engagements</EmptyTitle>
          <EmptyDescription>{emptyMessage}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {hide !== 'client' && <TableHead>Client</TableHead>}
            {hide !== 'firm' && <TableHead>Firm</TableHead>}
            <TableHead className="hidden md:table-cell">Issues</TableHead>
            <TableHead className="text-right">Income</TableHead>
            <TableHead className="hidden lg:table-cell">Quarters</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Summary</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.engagement_hk}>
              {hide !== 'client' && (
                <TableCell className="max-w-56 whitespace-normal align-top">
                  <EntityLink kind="client" id={row.client_id} name={row.client} />
                </TableCell>
              )}
              {hide !== 'firm' && (
                <TableCell className="max-w-56 whitespace-normal align-top">
                  <EntityLink kind="firm" id={row.registrant_id} name={row.firm} />
                </TableCell>
              )}
              <TableCell className="hidden align-top md:table-cell">
                <div className="flex flex-wrap gap-1">
                  {splitCodes(row.issue_codes).map((code) => (
                    <Badge key={code} variant="outline" asChild>
                      <EntityLink kind="topic" id={code} className="font-normal no-underline" />
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-right align-top tabular-nums">{money(row.total_income)}</TableCell>
              <TableCell className="hidden align-top whitespace-nowrap lg:table-cell">
                {quarterLabel(row.first_period)} to {quarterLabel(row.last_period)}
                <span className="block text-xs text-muted-foreground">{count(row.quarters_active)} reported</span>
              </TableCell>
              <TableCell className="align-top">
                <StatusBadge status={row.engagement_status} />
              </TableCell>
              <TableCell className="hidden max-w-md whitespace-normal align-top text-sm text-muted-foreground md:table-cell">
                {row.ai_summary ?? 'No summary yet.'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
