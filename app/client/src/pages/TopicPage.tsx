import { useMemo } from 'react';
import { useParams } from 'react-router';
import { sql } from '@databricks/appkit-ui/js';
import type { SQLStringMarker } from '@databricks/appkit-ui/js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  useAnalyticsQuery,
} from '@databricks/appkit-ui/react';
import { EngagementTable } from '@/components/EngagementTable';
import { EntityLink } from '@/components/EntityLink';
import { PageState } from '@/components/PageState';
import { QuarterChart } from '@/components/QuarterChart';
import { RankedBars } from '@/components/RankedBars';
import { StatTiles } from '@/components/StatTiles';
import { count, money, toNumber } from '@/lib/format';
import { clientPath, firmPath } from '@/lib/routes';
import { usePageTitle } from '@/lib/usePageTitle';
import { HeaderSkeleton, Retryable } from '@/pages/Topic/Retryable';

/** The filing years in the data slice; every figure on the page covers this span. */
const PERIOD = '2024 to 2025';

type TopicParams = { code: SQLStringMarker };

interface SectionProps {
  code: string;
  params: TopicParams;
  onRetry: () => void;
}

function pluralize(value: number | string, singular: string): string {
  const n = toNumber(value);
  return `${count(n)} ${n === 1 ? singular : `${singular}s`}`;
}

/** Topic page: one issue code, its income by quarter, who pays, who is paid, and the bills cited. */
export function TopicPage() {
  const { code = '' } = useParams();
  const issueCode = code.trim().toUpperCase();
  return (
    <Retryable skeleton={<HeaderSkeleton />}>{(retry) => <TopicBody code={issueCode} onRetry={retry} />}</Retryable>
  );
}

function TopicBody({ code, onRetry }: { code: string; onRetry: () => void }) {
  const params = useMemo<TopicParams>(() => ({ code: sql.string(code) }), [code]);
  const detail = useAnalyticsQuery('topic_detail', params);
  const topic = detail.data?.[0];
  usePageTitle(topic ? `${code} ${topic.issue_name}` : code);

  const tiles = useMemo(
    () =>
      topic
        ? [
            {
              id: 'income',
              label: 'Reported income',
              value: money(topic.total_income, { compact: true }),
              hint: `U.S. dollars, ${PERIOD}`,
            },
            {
              id: 'engagements',
              label: 'Engagements',
              value: count(topic.engagement_count),
              hint: `firm and client pairs, ${PERIOD}`,
            },
            { id: 'clients', label: 'Clients', value: count(topic.client_count), hint: `organizations, ${PERIOD}` },
            { id: 'firms', label: 'Firms', value: count(topic.firm_count), hint: `registrants, ${PERIOD}` },
          ]
        : [],
    [topic]
  );

  return (
    <div className="space-y-8">
      <PageState
        loading={detail.loading}
        error={detail.error}
        empty={!topic}
        emptyTitle={`No issue code ${code}`}
        emptyMessage={`${code} is not an issue code on any quarterly report in the ${PERIOD} filings. The issue areas on Home are the ones with filings.`}
        onRetry={onRetry}
        skeleton={<HeaderSkeleton />}
      >
        {topic && (
          <section className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">{topic.issue_name}</h1>
              <p className="text-muted-foreground">
                Issue code {code}, rank {count(topic.rank)} of all issue areas with {money(topic.total_income)} of
                reported income, {PERIOD}.
              </p>
            </div>
            <StatTiles tiles={tiles} columns={4} />
          </section>
        )}
      </PageState>

      {topic && (
        <>
          <Retryable>{(retry) => <TopicQuarters code={code} params={params} onRetry={retry} />}</Retryable>
          <div className="grid gap-6 md:grid-cols-2">
            <Retryable>{(retry) => <TopicClients code={code} params={params} onRetry={retry} />}</Retryable>
            <Retryable>{(retry) => <TopicFirms code={code} params={params} onRetry={retry} />}</Retryable>
          </div>
          <Retryable>{(retry) => <TopicBills code={code} params={params} onRetry={retry} />}</Retryable>
          <Retryable>{(retry) => <TopicEngagements code={code} params={params} onRetry={retry} />}</Retryable>
        </>
      )}
    </div>
  );
}

function TopicQuarters({ code, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('topic_quarters', params);
  const rows = useMemo(
    () => (data ?? []).map((row) => ({ period_end_date: row.period_end_date, value: toNumber(row.income) })),
    [data]
  );
  return (
    <PageState
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyTitle="No quarterly figures"
      emptyMessage={`No quarterly report in the ${PERIOD} filings lists ${code}, so there is no income to chart.`}
      onRetry={onRetry}
    >
      <QuarterChart title={`${code} lobbying income by quarter`} rows={rows} unit="dollars" />
    </PageState>
  );
}

function TopicClients({ code, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('topic_clients', params);
  const rows = useMemo(
    () =>
      (data ?? []).map((row) => ({
        id: row.client_id,
        name: row.client,
        value: toNumber(row.income),
        href: clientPath(row.client_id),
      })),
    [data]
  );
  return (
    <PageState
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyTitle="No clients ranked"
      emptyMessage={`No client reported income on a ${code} filing in ${PERIOD}.`}
      onRetry={onRetry}
    >
      <RankedBars
        title={`Top clients by ${code} income`}
        rows={rows}
        unit="dollars"
        description={`Reported income in U.S. dollars on filings listing ${code}, ${PERIOD}.`}
      />
    </PageState>
  );
}

function TopicFirms({ code, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('topic_firms', params);
  const rows = useMemo(
    () =>
      (data ?? []).map((row) => ({
        id: row.registrant_id,
        name: row.firm,
        value: toNumber(row.income),
        href: firmPath(row.registrant_id),
      })),
    [data]
  );
  return (
    <PageState
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyTitle="No firms ranked"
      emptyMessage={`No firm reported income on a ${code} filing in ${PERIOD}.`}
      onRetry={onRetry}
    >
      <RankedBars
        title={`Top firms by ${code} income`}
        rows={rows}
        unit="dollars"
        description={`Reported income in U.S. dollars on filings listing ${code}, ${PERIOD}.`}
      />
    </PageState>
  );
}

function TopicBills({ code, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('topic_bills', params);
  const rows = data ?? [];
  return (
    <PageState
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyTitle="No bills cited"
      emptyMessage={`No ${code} filing in ${PERIOD} names a bill number in its specific issues.`}
      onRetry={onRetry}
    >
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>Bills cited most on {code} filings</CardTitle>
          <CardDescription>
            Quarterly reports naming each bill under {code}, {PERIOD}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="divide-y">
            {rows.map((row) => (
              <li key={row.bill_key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                <EntityLink kind="bill" id={row.bill_key} name={row.bill_label} />
                <span className="text-sm tabular-nums text-muted-foreground">
                  {pluralize(row.filings_mentioning, 'filing')}, {pluralize(row.engagement_count, 'engagement')}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </PageState>
  );
}

function TopicEngagements({ code, params, onRetry }: SectionProps) {
  const { data, loading, error } = useAnalyticsQuery('topic_engagements', params);
  const rows = data ?? [];
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{code} engagements by reported income</h2>
        <p className="text-sm text-muted-foreground">
          One row per firm and client pair that listed {code}. Income is the pair&apos;s total in U.S. dollars across
          every issue it reported, {PERIOD}.
        </p>
      </div>
      <PageState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyTitle="No engagements"
        emptyMessage={`No firm and client pair listed ${code} on a quarterly report in ${PERIOD}.`}
        onRetry={onRetry}
      >
        <EngagementTable rows={rows} emptyMessage={`No firm and client pair listed ${code} in ${PERIOD}.`} />
      </PageState>
    </section>
  );
}
