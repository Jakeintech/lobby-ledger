import { useMemo } from 'react';
import { Link } from 'react-router';
import { Badge, useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';
import { EntityLink, LINK_CLASS } from '@/components/EntityLink';
import type { EntityKind } from '@/components/EntityLink';
import { PageState } from '@/components/PageState';
import { count, money, toNumber } from '@/lib/format';
import { HOME_PATH, organizationPath } from '@/lib/routes';

export interface SearchResultsProps {
  /** The trimmed search text from the query string. */
  q: string;
  onRetry: () => void;
}

/** `gold.search_entity.kind` is `client` or `firm`; anything else is treated as a client. */
function entityKind(kind: string): Extract<EntityKind, 'client' | 'firm'> {
  return kind === 'firm' ? 'firm' : 'client';
}

/**
 * Clients and firms whose name contains the typed text, ranked by reported
 * income. A client organization with several rows across firms appears once,
 * with the organization's total, and links to the organization page.
 */
export function SearchResults({ q, onRetry }: SearchResultsProps) {
  const params = useMemo(() => ({ q: sql.string(q) }), [q]);
  const { data, loading, error } = useAnalyticsQuery('search_entities', params);
  const rows = data ?? [];

  return (
    <section aria-labelledby="search-results-heading" className="space-y-3">
      <h2 id="search-results-heading" className="text-lg font-semibold tracking-tight">
        Clients and firms matching &ldquo;{q}&rdquo;
      </h2>
      <PageState
        loading={loading}
        error={error}
        empty={!loading && !error && rows.length === 0}
        emptyTitle="No matching names"
        emptyMessage={`No client or firm name in the data contains "${q}". Try a shorter word, or a bill number such as H.R. 1.`}
        onRetry={onRetry}
        backHref={HOME_PATH}
        backLabel="Clear search"
      >
        <p className="text-sm text-muted-foreground">
          {count(rows.length)} {rows.length === 1 ? 'match' : 'matches'}, ranked by reported income over 2024 to 2025.
        </p>
        <ol className="divide-y rounded-lg border">
          {rows.map((row) => {
            const kind = entityKind(row.kind);
            const clientRows = toNumber(row.client_count);
            const firms = toNumber(row.firm_count);
            const organization = kind === 'client' && clientRows > 1 && row.organization_hk;
            return (
              <li key={`${kind}-${row.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex min-w-0 items-center gap-2">
                  <Badge variant="outline" className="shrink-0 capitalize">
                    {organization ? 'organization' : kind}
                  </Badge>
                  <span className="min-w-0">
                    {organization ? (
                      <Link to={organizationPath(row.organization_hk)} className={`${LINK_CLASS} block truncate`}>
                        {row.name}
                      </Link>
                    ) : (
                      <EntityLink kind={kind} id={row.id} name={row.name} className="block truncate" />
                    )}
                    {organization && (
                      <span className="block text-xs text-muted-foreground">
                        {count(clientRows)} client rows {firms === 1 ? 'with one firm' : `across ${count(firms)} firms`}
                      </span>
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums">{money(row.total_income)}</span>
              </li>
            );
          })}
        </ol>
      </PageState>
    </section>
  );
}
