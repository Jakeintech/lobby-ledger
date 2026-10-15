import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { usePageTitle } from '@/lib/usePageTitle';
import { HOME_PATH } from '@/lib/routes';
import { DataFreshness } from '@/pages/About/DataFreshness';
import { RetrySection } from '@/pages/Home/RetrySection';

/** When the filings were last pulled from the LDA API. Keep in step with FRESHNESS in App.tsx. */
const PULLED_ON = '15 October 2026';
const SOURCE_URL = 'https://lda.senate.gov/api/';
const REPO_URL = 'https://github.com/Jakeintech/lobby-ledger';

const DIAGRAM = `LDA API (lda.senate.gov)
   |  ingest/pull_lda.py      every firm and client pair with a $500,000 filing in 2024 or 2025
   v
BRONZE   bronze.lda_*         source-shaped CSV to Delta, plus load_date and record_source
   |  sql/lakehouse.sql       hard rules only: cast, trim, upper, md5, WHERE NOT EXISTS
   v
SILVER   Raw Vault            hub_registrant, hub_client, hub_lobbyist, hub_issue, hub_government_entity
                              link_engagement, link_engagement_* , sat_* (hash_diff, effectivity)
   |                          soft rules: latest amendment wins, blank income is 0, active or lapsed
   v
GOLD     one mart per page    topic, topic_quarter, bill, bill_quarter, client, client_quarter,
                              firm, firm_quarter, lobbyist, lobbyist_engagement, engagement,
                              engagement_quarter, search_entity, engagement_ai_summary (ai_query)
   |  SQL warehouse + Unity Catalog, one read-only identity per host
   v
APP      config/queries/*.sql one file per page section -> /api/analytics/query/<name> -> React`;

const LINK_CLASS = 'font-medium text-primary underline-offset-4 hover:underline';

/**
 * One note: the heading sits in the left column at desktop width and above
 * the text on a phone, with a rule between notes. The rule is the structure.
 */
function Note({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-2 border-t border-border pt-5 md:grid-cols-[12rem_minmax(0,1fr)]"
    >
      <h2 id={`${id}-heading`} className="text-base font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="min-w-0 space-y-3 text-foreground">{children}</div>
    </section>
  );
}

/** Source, freshness, definitions, the attribution rule, the slice, the AI summaries and the lakehouse. */
export function AboutPage() {
  usePageTitle('About the data');

  return (
    <article className="max-w-4xl space-y-8">
      <header className="max-w-2xl space-y-2 pt-6">
        <h1 className="text-3xl sm:text-4xl">About the data</h1>
        <p className="text-lg text-muted-foreground">
          Where the filings come from, what reported income and a quarter mean, why topic totals overlap, how the slice
          was chosen, and how the summaries are produced.
        </p>
      </header>

      <Note id="source" title="Source and freshness">
        <p>
          Every figure comes from the U.S. Senate Office of Public Records{' '}
          <a href={SOURCE_URL} className={LINK_CLASS} rel="noreferrer">
            Lobbying Disclosure Act API
          </a>
          , the public database of filings required by the Lobbying Disclosure Act of 1995. The filings were last pulled
          on {PULLED_ON}. The figures below are read live from the Gold layer.
        </p>
        <RetrySection>{(retry) => <DataFreshness onRetry={retry} />}</RetrySection>
      </Note>

      <Note id="income" title="Reported income">
        <p>
          A lobbying firm files one report per client per quarter and discloses the income it received from that client
          for lobbying during the quarter, in U.S. dollars, rounded to the nearest $10,000 by the filer. Lobby Ledger
          shows that number as reported and never adjusts it. Registrations carry no income. The Act allows a report to
          leave the income field blank, and Lobby Ledger counts a blank as $0 rather than dropping the quarter, so a
          chart with a $0 bar means the firm filed but reported nothing, not that the quarter is missing.
        </p>
      </Note>

      <Note id="quarters" title="Quarters">
        <p>
          Every chart puts time on the x-axis as calendar quarters, labelled by their end date: Q1 ends 31 March, Q2
          ends 30 June, Q3 ends 30 September and Q4 ends 31 December. A filing is assigned to the quarter of the period
          it reports on, not the date it was posted, so a late filing still lands in the quarter it covers. An
          engagement that terminates mid-year has no quarters after its termination date; the last reported value is
          never carried forward.
        </p>
      </Note>

      <Note id="amendments" title="Amendments">
        <p>
          A filer can amend a quarterly report any number of times. For each firm, client and quarter, Lobby Ledger
          keeps only the latest amendment and uses its income, lobbyists and issues. Earlier versions stay in the Silver
          layer as history but never count toward a chart or a total, so no quarter is counted twice.
        </p>
      </Note>

      <Note id="attribution" title="Issue attribution overlap">
        <p>
          A filing lists one or more general issue codes, such as TAX or HCR, and reports a single income figure for the
          whole quarter. The filing does not split that income between issues, so Lobby Ledger counts the full amount
          toward every issue the filing lists. Topic totals therefore overlap: a $500,000 report that lists TAX and HCR
          adds $500,000 to each. For that reason no page adds topic totals together, and the issue areas on Home add up
          to more than the total reported income.
        </p>
      </Note>

      <Note id="slice" title="The $500,000 slice">
        <p>
          The data is a slice, not the whole database. It holds every firm and client pair that reported at least
          $500,000 of income on a single quarterly filing in 2024 or 2025, together with that pair&rsquo;s complete 2024
          to 2025 filing history, including the quarters below the threshold, registrations, amendments and
          terminations. Pairs that never crossed $500,000 in one quarter are not included, so a client or firm absent
          from search may still lobby; it just did so below that level. Years before 2024, foreign entities and
          affiliated organizations are out of scope.
        </p>
      </Note>

      <Note id="summaries" title="AI summaries">
        <p>
          The one-line summary beside each engagement is written by a large language model from the free-text issue
          descriptions on that engagement&rsquo;s filings, using the Databricks <code>ai_query</code> function. It is
          generated once per engagement and not reviewed by a person. Treat it as a pointer to what the filings say,
          check it against the filing before relying on it, and expect it to miss nuance or to repeat the filer&rsquo;s
          own framing.
        </p>
      </Note>

      <Note id="lakehouse" title="The lakehouse">
        <p>
          Lobby Ledger runs on a Databricks lakehouse with three layers. Bronze keeps the filings as they arrived.
          Silver is a Data Vault 2.0 Raw Vault, which records every version of every filing without applying any
          business rule. Gold applies the rules above and builds one mart per page. The app reads Gold only, through one
          SQL file per page section, as a single read-only identity.
        </p>
        <pre
          className="overflow-x-auto border-y border-border py-3 font-mono text-xs leading-relaxed text-foreground"
          aria-label="Lakehouse diagram: LDA API to Bronze, Silver, Gold, then the app"
        >
          {DIAGRAM}
        </pre>
        <p>
          The SQL, the ingest script and this app are open source at{' '}
          <a href={REPO_URL} className={LINK_CLASS} rel="noreferrer">
            github.com/Jakeintech/lobby-ledger
          </a>
          .
        </p>
      </Note>

      <p className="border-t border-border pt-5">
        <Link to={HOME_PATH} className={LINK_CLASS}>
          Back to Home
        </Link>
      </p>
    </article>
  );
}
