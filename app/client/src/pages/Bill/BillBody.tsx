import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { sql } from '@databricks/appkit-ui/js';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { LINK_CLASS } from '@/components/EntityLink';
import { PageState } from '@/components/PageState';
import { StatTiles } from '@/components/StatTiles';
import type { StatTile } from '@/components/StatTiles';
import { billLabel, count, money, toNumber } from '@/lib/format';
import { BillCiters, BillEngagements } from '@/pages/Bill/BillEngagements';
import { BillQuarters } from '@/pages/Bill/BillQuarters';
import { MilestoneWindows } from '@/pages/Bill/MilestoneWindows';
import { PERIOD, longDate } from '@/pages/Bill/billText';
import type { BillParams } from '@/pages/Bill/billText';
import { CONGRESSES, billsCongressPath, ordinal } from '@/pages/Bills/congress';
import { HeaderSkeleton, Retryable } from '@/pages/Topic/Retryable';

export interface BillBodyProps {
  billKey: string;
  congress: number;
  onRetry: () => void;
}

/** One bill in one Congress: the header and tiles, the quarterly chart, the milestone windows, the top citers and the engagement table. */
export function BillBody({ billKey, congress, onRetry }: BillBodyProps) {
  const params = useMemo<BillParams>(
    () => ({ congress: sql.string(String(congress)), key: sql.string(billKey) }),
    [congress, billKey]
  );
  const detail = useAnalyticsQuery('bill_detail', params);
  const bill = detail.data?.[0];
  const label = bill?.bill_label ?? billLabel(billKey);
  const other = CONGRESSES.find((c) => c.congress !== congress)?.congress;

  // The quarter picked on the chart; the engagement table narrows to it.
  const [quarter, setQuarter] = useState<string | null>(null);

  const tiles = useMemo<StatTile[]>(() => {
    if (!bill) return [];
    const filings = toNumber(bill.filings_mentioning);
    return [
      {
        id: 'filings',
        label: 'Filings mentioning',
        value: count(filings),
        hint: 'quarterly reports',
        countUp: { to: filings, format: count },
      },
      {
        id: 'engagements',
        label: 'Engagements',
        value: count(bill.engagement_count),
        hint: `firm and client pairs citing ${label}`,
      },
      {
        id: 'income',
        label: 'Reported income',
        value: money(bill.income, { compact: true }),
        hint: 'by those pairs, all issues',
      },
      {
        id: 'congress',
        label: 'Congress',
        value: ordinal(toNumber(bill.congress)),
        hint: bill.is_law ? 'became law' : bill.stage?.trim() || 'stage unknown',
      },
    ];
  }, [bill, label]);

  const introduced = longDate(bill?.introduced_date);
  const latestAction = longDate(bill?.latest_action_date);
  const sponsor = bill?.sponsor_name?.trim();
  const sponsorTag = [bill?.sponsor_party?.trim(), bill?.sponsor_state?.trim()].filter(Boolean).join(', ');

  return (
    <div className="space-y-10">
      <PageState
        loading={detail.loading}
        error={detail.error}
        empty={!bill}
        emptyTitle={`No filings mention ${label} in the ${ordinal(congress)} Congress`}
        emptyMessage={`No quarterly report in the ${PERIOD} filings names ${label} in its specific issues for the ${ordinal(congress)} Congress. Check the bill number, or try the other Congress.`}
        onRetry={onRetry}
        skeleton={<HeaderSkeleton />}
        backHref={other === undefined ? undefined : billsCongressPath(other)}
        backLabel={other === undefined ? undefined : `Bills in the ${ordinal(other)} Congress`}
      >
        {bill && (
          <header className="space-y-5">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl">{label}</h1>
              {bill.title?.trim() ? (
                <p className="text-lg text-muted-foreground">{bill.title.trim()}</p>
              ) : (
                <p className="text-muted-foreground">
                  Named on {count(bill.filings_mentioning)} quarterly reports by {count(bill.engagement_count)}{' '}
                  engagements in the {ordinal(toNumber(bill.congress))} Congress.
                </p>
              )}
              {(sponsor || introduced || latestAction) && (
                <p className="text-sm text-muted-foreground">
                  {sponsor && `Sponsored by ${sponsor}${sponsorTag ? ` (${sponsorTag})` : ''}. `}
                  {introduced && `Introduced ${introduced}. `}
                  {latestAction &&
                    `Latest action ${latestAction}${bill.latest_action_text?.trim() ? `: ${bill.latest_action_text.trim()}` : ''}`}
                </p>
              )}
              <p className="text-sm">
                {bill.congress_url?.trim() && (
                  <>
                    <a href={bill.congress_url.trim()} className={LINK_CLASS} rel="noreferrer">
                      Read the bill on Congress.gov
                    </a>
                    {' or '}
                  </>
                )}
                <Link to={billsCongressPath(congress)} className={LINK_CLASS}>
                  see every bill lobbied in the {ordinal(congress)} Congress
                </Link>
                .
              </p>
            </div>
            <StatTiles tiles={tiles} columns={4} />
          </header>
        )}
      </PageState>

      {bill && (
        <>
          <Retryable>
            {(retry) => (
              <BillQuarters label={label} params={params} onRetry={retry} selected={quarter} onSelect={setQuarter} />
            )}
          </Retryable>
          <Retryable>{(retry) => <MilestoneWindows label={label} params={params} onRetry={retry} />}</Retryable>
          <Retryable>{(retry) => <BillCiters label={label} params={params} onRetry={retry} />}</Retryable>
          <Retryable>
            {(retry) => <BillEngagements label={label} params={params} onRetry={retry} quarter={quarter} />}
          </Retryable>
        </>
      )}
    </div>
  );
}
