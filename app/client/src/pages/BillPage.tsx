import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router';
import { sql } from '@databricks/appkit-ui/js';
import type { SQLStringMarker } from '@databricks/appkit-ui/js';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { PageState } from '@/components/PageState';
import { billLabel, normalizeBillKey } from '@/lib/format';
import { billInCongressPath, billsPath } from '@/lib/routes';
import { usePageTitle } from '@/lib/usePageTitle';
import { BillBody } from '@/pages/Bill/BillBody';
import { PERIOD } from '@/pages/Bill/billText';
import { congressFromParam } from '@/pages/Bills/congress';
import { HeaderSkeleton, Retryable } from '@/pages/Topic/Retryable';

type LookupParams = { key: SQLStringMarker };

/**
 * Bill page. `/bill/:congress/:key` is the canonical route and renders that
 * Congress directly; the bare `/bill/:key` looks the key up and redirects
 * to the newest Congress that has filings for it, so the URL in the address
 * bar always names the Congress on the page.
 */
export function BillPage() {
  const { congress: congressParam, key = '' } = useParams();
  const billKey = normalizeBillKey(key) ?? key.trim().toUpperCase();
  const congress = congressFromParam(congressParam);

  usePageTitle(billLabel(billKey));
  // A Congress segment outside the data falls through to the lookup, which finds the newest one that has the bill.
  return (
    <Retryable skeleton={<HeaderSkeleton />}>
      {(retry) =>
        congress === null ? (
          <BillLookup key={billKey} billKey={billKey} onRetry={retry} />
        ) : (
          <BillBody key={`${congress}/${billKey}`} billKey={billKey} congress={congress} onRetry={retry} />
        )
      }
    </Retryable>
  );
}

/** A bill key can appear in more than one Congress; the bare route redirects to the newest one that has filings. */
function BillLookup({ billKey, onRetry }: { billKey: string; onRetry: () => void }) {
  const params = useMemo<LookupParams>(() => ({ key: sql.string(billKey) }), [billKey]);
  const lookup = useAnalyticsQuery('bill_lookup', params);
  const found = lookup.data?.[0];
  const label = billLabel(billKey);
  return (
    <PageState
      loading={lookup.loading}
      error={lookup.error}
      empty={!found}
      emptyTitle={`No filings mention ${label}`}
      emptyMessage={`No quarterly report in the ${PERIOD} filings names ${label} in its specific issues. Check the bill number, or search for a client or firm.`}
      onRetry={onRetry}
      skeleton={<HeaderSkeleton />}
      backHref={billsPath()}
      backLabel="See the bills lobbied most"
    >
      {found && <Navigate replace to={billInCongressPath(found.congress, found.bill_key)} />}
    </PageState>
  );
}
