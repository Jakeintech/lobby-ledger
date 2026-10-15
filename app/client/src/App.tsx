import { useMemo, useState } from 'react';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';

const ISSUE_CODES = ['', 'TAX', 'HCR', 'FIN', 'ENG', 'TRD', 'EDU', 'BUD'];
const YEARS = [0, 2024, 2025];
const QUARTERS = ['2024-03-31', '2024-06-30', '2024-09-30', '2024-12-31',
                  '2025-03-31', '2025-06-30', '2025-09-30', '2025-12-31'];

const money = (v: unknown) => `$${Math.round(Number(v ?? 0)).toLocaleString()}`;
const day = (v: unknown) => String(v ?? '').slice(0, 10);

function Team({ engagementHk }: { engagementHk: string }) {
  const params = useMemo(() => ({ engagement_hk: sql.string(engagementHk) }), [engagementHk]);
  const { data, loading, error } = useAnalyticsQuery('engagement_team', params);
  if (loading) return <p>Loading team...</p>;
  if (error) return <p className="text-red-600">{String(error)}</p>;
  const rows = data ?? [];
  return (
    <div>
      <p className="text-xs text-gray-500">Queried as {String(rows[0]?.queried_as ?? 'you')} (on behalf of user)</p>
      <table className="w-full text-sm">
        <thead><tr className="text-left"><th>Lobbyist</th><th>Quarters</th><th>First</th><th>Last</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.lobbyist)}>
              <td>{String(r.lobbyist)}</td><td>{String(r.quarters_listed)}</td>
              <td>{day(r.first_period)}</td><td>{day(r.last_period)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AsOf({ engagementHk }: { engagementHk: string }) {
  const [asOf, setAsOf] = useState('2025-06-30');
  const params = useMemo(() => ({ engagement_hk: sql.string(engagementHk), as_of_date: sql.date(asOf) }),
    [engagementHk, asOf]);
  const { data, loading } = useAnalyticsQuery('engagement_asof', params);
  const row = data?.[0];
  return (
    <div className="space-y-2">
      <label className="text-sm">As of quarter end{' '}
        <select value={asOf} onChange={(e) => setAsOf(e.target.value)} className="border rounded px-1">
          {QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
        </select>
      </label>
      {loading ? <p>Loading...</p> : !row ? <p className="text-sm">No filing on or before this date.</p> : (
        <dl className="text-sm grid grid-cols-2 gap-1">
          <dt>Status</dt><dd>{String(row.status_as_of)}</dd>
          <dt>Latest filing</dt><dd>{String(row.filing_type)} for {day(row.as_of_period_end)}</dd>
          <dt>Income that quarter</dt><dd>{money(row.income_that_quarter)}</dd>
          <dt>Team</dt><dd>{String(row.team_as_of ?? '')}</dd>
        </dl>
      )}
    </div>
  );
}

export default function App() {
  const [issueCode, setIssueCode] = useState('TAX');
  const [keyword, setKeyword] = useState('');
  const [year, setYear] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const params = useMemo(() => ({
    issue_code: sql.string(issueCode),
    keyword: sql.string(keyword),
    year: sql.int(year),
  }), [issueCode, keyword, year]);
  const { data, loading, error } = useAnalyticsQuery('experience_search', params);
  const rows = data ?? [];
  const current = rows.find((r) => r.engagement_hk === selected);

  return (
    <main className="p-6 space-y-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold">Lobbying Experience Search</h1>
      <p className="text-sm text-gray-600">Find engagements like this one, who worked them, and what they were about. Source: U.S. Lobbying Disclosure Act filings.</p>

      <div className="flex gap-3 items-end flex-wrap">
        <label className="text-sm">Issue code<br />
          <select value={issueCode} onChange={(e) => setIssueCode(e.target.value)} className="border rounded px-2 py-1">
            {ISSUE_CODES.map((c) => <option key={c} value={c}>{c || 'Any'}</option>)}
          </select>
        </label>
        <label className="text-sm">Client or topic keyword<br />
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. endowment"
                 className="border rounded px-2 py-1" />
        </label>
        <label className="text-sm">Year<br />
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border rounded px-2 py-1">
            {YEARS.map((y) => <option key={y} value={y}>{y || 'Any'}</option>)}
          </select>
        </label>
        <span className="text-sm text-gray-500">{loading ? 'Searching...' : `${rows.length} engagements`}</span>
      </div>
      {error && <p className="text-red-600">{String(error)}</p>}

      <div className="grid grid-cols-3 gap-4">
        <table className="col-span-2 text-sm w-full">
          <thead>
            <tr className="text-left border-b">
              <th>Firm</th><th>Client</th><th>Issues</th><th>Team</th><th>Income</th><th>Last period</th><th>Status</th><th>AI summary</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.engagement_hk)} onClick={() => setSelected(String(r.engagement_hk))}
                  className={`border-b cursor-pointer align-top ${selected === r.engagement_hk ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                <td>{String(r.firm)}</td><td>{String(r.client)}</td><td>{String(r.issue_codes ?? '')}</td>
                <td>{String(r.lobbyist_count)}</td><td>{money(r.total_income)}</td><td>{day(r.last_period)}</td>
                <td>{String(r.engagement_status)}</td><td className="text-gray-700">{String(r.ai_summary ?? '')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <aside className="border rounded p-3 space-y-4">
          {!current ? <p className="text-sm text-gray-500">Select an engagement to see its team and history.</p> : (
            <>
              <h2 className="font-semibold">{String(current.client)}<br />
                <span className="text-sm font-normal">{String(current.firm)}</span></h2>
              <section><h3 className="font-medium">Team</h3><Team engagementHk={String(current.engagement_hk)} /></section>
              <section><h3 className="font-medium">Point in time</h3><AsOf engagementHk={String(current.engagement_hk)} /></section>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
