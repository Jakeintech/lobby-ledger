import { Link, Navigate, useSearchParams } from 'react-router';
import { SearchBox } from '@/components/SearchBox';
import { normalizeBillKey } from '@/lib/format';
import { ABOUT_PATH, billPath } from '@/lib/routes';
import { usePageTitle } from '@/lib/usePageTitle';
import { IncomeOverview } from '@/pages/Home/IncomeOverview';
import { RetrySection } from '@/pages/Home/RetrySection';
import { SearchResults } from '@/pages/Home/SearchResults';
import { TopicTiles } from '@/pages/Home/TopicTiles';

/**
 * Home: a large search box, search results when the URL carries `?q=`,
 * total reported income by quarter, issue areas ranked by income, and three
 * sentences on what the data is and is not.
 */
export function HomePage() {
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') ?? '').trim();
  usePageTitle(q ? `Search: ${q}` : undefined);

  // A bill number pasted straight into the URL belongs on the bill page.
  const billKey = q ? normalizeBillKey(q) : null;
  if (billKey) return <Navigate to={billPath(billKey)} replace />;

  return (
    <div className="space-y-10">
      <section aria-labelledby="home-heading" className="mx-auto max-w-2xl space-y-4 pt-4">
        <h1 id="home-heading" className="text-3xl font-semibold tracking-tight">
          Who lobbies Congress
        </h1>
        <p className="text-muted-foreground">
          Start with a bill number such as H.R. 1, or the name of a client or lobbying firm. Every name on every page is
          a link.
        </p>
        <SearchBox key={q} size="large" initialValue={q} />
      </section>

      {q && <RetrySection>{(retry) => <SearchResults key={q} q={q} onRetry={retry} />}</RetrySection>}

      <section aria-labelledby="income-heading" className="space-y-3">
        <h2 id="income-heading" className="text-lg font-semibold tracking-tight">
          Reported income across every engagement
        </h2>
        <RetrySection>{(retry) => <IncomeOverview onRetry={retry} />}</RetrySection>
      </section>

      <section aria-labelledby="topics-heading" className="space-y-3">
        <div className="space-y-1">
          <h2 id="topics-heading" className="text-lg font-semibold tracking-tight">
            Issue areas ranked by reported income
          </h2>
          <p className="text-sm text-muted-foreground">
            Reported income in U.S. dollars, 2024 to 2025. A filing counts toward every issue it lists, so these figures
            overlap and are not summed.
          </p>
        </div>
        <RetrySection>{(retry) => <TopicTiles onRetry={retry} />}</RetrySection>
      </section>

      <section aria-labelledby="data-heading" className="max-w-3xl space-y-3">
        <h2 id="data-heading" className="text-lg font-semibold tracking-tight">
          What this data is
        </h2>
        <p className="text-muted-foreground">
          Lobby Ledger covers every lobbying firm and client pair that reported at least $500,000 of income on one
          quarterly filing in 2024 or 2025, with that pair&rsquo;s full 2024 to 2025 filing history from the U.S. Senate
          Lobbying Disclosure Act database. Reported income is the amount the firm disclosed receiving from the client
          for the quarter: it is rounded by the filer, it is $0 on registrations and on reports that leave the field
          blank, and it counts in full toward every issue listed on the filing. Engagement summaries are written by a
          language model from the filing text and are a starting point, not a substitute for the filing itself.
        </p>
        <p>
          <Link
            to={ABOUT_PATH}
            className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            Read more about the data
          </Link>
        </p>
      </section>
    </div>
  );
}
