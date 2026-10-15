import { EntityLink } from '@/components/EntityLink';
import { normalizeBillKey } from '@/lib/format';

/** The columns of `gold.engagement` this block reads. */
export interface BillsAndEntitiesRow {
  engagement_hk: string;
  registrant_id: string;
  firm: string;
  /** Comma separated bill labels, for example `H.R. 1, S. 1477`. */
  bill_labels: string | null;
  /** Comma separated government entity names, upper case as the vault stores them. */
  government_entities: string | null;
}

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

/**
 * The bills each firm cited and the government entities it reported
 * contacting on this client's behalf. The engagement table leaves these out
 * for width, so the client page lists them here, one block per firm.
 */
export function BillsAndEntities({ rows, clientName }: { rows: BillsAndEntitiesRow[]; clientName: string }) {
  const withDetail = rows
    .map((row) => ({
      key: row.engagement_hk,
      registrantId: row.registrant_id,
      firm: row.firm,
      bills: splitList(row.bill_labels),
      entities: splitList(row.government_entities),
    }))
    .filter((row) => row.bills.length > 0 || row.entities.length > 0);

  return (
    <figure className="min-w-0">
      <figcaption className="border-t border-border pt-3">
        <p className="font-medium text-foreground">Bills cited and government entities contacted for {clientName}</p>
        <p className="text-sm text-muted-foreground">
          From the activity sections of the quarterly reports, 2024 to 2025. A bill counts once per engagement however
          many filings mention it.
        </p>
      </figcaption>
      {withDetail.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          None of the filings for this client named a specific bill or a government entity contacted.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {withDetail.map((row) => (
            <li key={row.key} className="min-w-0 space-y-1.5 py-3 first:pt-0">
              <EntityLink kind="firm" id={row.registrantId} name={row.firm} />
              <dl className="grid gap-1 text-sm sm:grid-cols-[8rem_1fr]">
                <dt className="text-muted-foreground">Bills cited</dt>
                <dd className="flex flex-wrap gap-x-3 gap-y-1">
                  {row.bills.length === 0
                    ? 'None named'
                    : row.bills.map((label) => {
                        const key = normalizeBillKey(label);
                        return key ? (
                          <EntityLink key={label} kind="bill" id={key} name={label} />
                        ) : (
                          <span key={label}>{label}</span>
                        );
                      })}
                </dd>
                <dt className="text-muted-foreground">Contacted</dt>
                <dd className="break-words">{row.entities.length === 0 ? 'None named' : row.entities.join(', ')}</dd>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
