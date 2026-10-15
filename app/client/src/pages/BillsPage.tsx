import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { sql } from '@databricks/appkit-ui/js';
import type { SQLStringMarker } from '@databricks/appkit-ui/js';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { PageState } from '@/components/PageState';
import { count } from '@/lib/format';
import { usePageTitle } from '@/lib/usePageTitle';
import { BillTable } from '@/pages/Bills/BillTable';
import type { BillRow } from '@/pages/Bills/BillTable';
import { Segmented } from '@/pages/Bills/Segmented';
import {
  CONGRESSES,
  DEFAULT_CONGRESS,
  billsCongressPath,
  filingYearOf,
  ordinal,
  parseCongress,
} from '@/pages/Bills/congress';
import { Retryable } from '@/pages/Topic/Retryable';

/** How many bills the top list holds; the query stops there. */
const TOP_BILLS = 50;

type CongressParams = { congress: SQLStringMarker };

interface SectionProps {
  congress: number;
  params: CongressParams;
  onRetry: () => void;
}

const CONGRESS_OPTIONS = CONGRESSES.map((c) => ({
  value: String(c.congress),
  label: `${ordinal(c.congress)} Congress`,
}));

/** Bills page: the bills quarterly reports name most in one Congress, and the ones among them that became law. */
export function BillsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const congress = parseCongress(searchParams.get('congress'));
  const filingYear = filingYearOf(congress);
  usePageTitle(`Bills, ${ordinal(congress)} Congress`);

  const params = useMemo<CongressParams>(() => ({ congress: sql.string(String(congress)) }), [congress]);

  function selectCongress(value: string) {
    const next = parseCongress(value);
    setSearchParams(next === DEFAULT_CONGRESS ? {} : { congress: String(next) }, { replace: true });
  }

  return (
    <div className="space-y-10">
      <header className="space-y-5">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl">Bills lobbied most in the {ordinal(congress)} Congress</h1>
          <p className="text-muted-foreground">
            The bills that quarterly reports filed in {filingYear ?? 'this Congress'} name in their specific issues,
            ranked by the reported income of the engagements citing each one. Titles and stages come from Congress.gov.
          </p>
        </div>
        <Segmented label="Congress" options={CONGRESS_OPTIONS} value={String(congress)} onChange={selectCongress} />
      </header>

      <Retryable>
        {(retry) => <TopBills key={congress} congress={congress} params={params} onRetry={retry} />}
      </Retryable>
      <Retryable>
        {(retry) => <BecameLaw key={congress} congress={congress} params={params} onRetry={retry} />}
      </Retryable>
    </div>
  );
}

function TopBills({ congress, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('bills_top', params);
  const rows: BillRow[] = data ?? [];
  const other = CONGRESSES.find((c) => c.congress !== congress)?.congress;
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          Top {count(TOP_BILLS)} bills by reported income, {ordinal(congress)} Congress
        </h2>
        <p className="text-sm text-muted-foreground">
          Income is the total in U.S. dollars reported by every firm and client pair whose filings name the bill, across
          all the issues those pairs lobbied on in {filingYearOf(congress) ?? 'the Congress'}. Filings counts quarterly
          reports naming the bill; engagements counts the pairs. Each bill is a link.
        </p>
      </div>
      <PageState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyTitle={`No bills cited in the ${ordinal(congress)} Congress`}
        emptyMessage={`No quarterly report filed in ${filingYearOf(congress) ?? 'that year'} names a bill number in its specific issues, or the bill tables have not been built yet.`}
        onRetry={onRetry}
        backHref={other === undefined ? undefined : billsCongressPath(other)}
        backLabel={other === undefined ? undefined : `See the ${ordinal(other)} Congress`}
      >
        <BillTable
          rows={rows}
          congress={congress}
          emptyMessage={`No bill is cited on a quarterly report from the ${ordinal(congress)} Congress.`}
        />
      </PageState>
    </section>
  );
}

function BecameLaw({ congress, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('bills_became_law', params);
  const rows: BillRow[] = data ?? [];
  const other = CONGRESSES.find((c) => c.congress !== congress)?.congress;
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          Lobbied bills that became law, {ordinal(congress)} Congress
        </h2>
        <p className="text-sm text-muted-foreground">
          The bills above that Congress.gov records as enacted, ranked by the same reported income in U.S. dollars.
        </p>
      </div>
      <PageState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyTitle="No enacted bills to show"
        emptyMessage={`No lobbied bill in the ${ordinal(congress)} Congress is recorded as law. Bill records from Congress.gov load after the filings, so this list stays empty until they arrive.`}
        onRetry={onRetry}
        backHref={other === undefined ? undefined : billsCongressPath(other)}
        backLabel={other === undefined ? undefined : `See the ${ordinal(other)} Congress`}
      >
        <BillTable
          rows={rows}
          congress={congress}
          emptyMessage={`No lobbied bill in the ${ordinal(congress)} Congress is recorded as law.`}
        />
      </PageState>
    </section>
  );
}
