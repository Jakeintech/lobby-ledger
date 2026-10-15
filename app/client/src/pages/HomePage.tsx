import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { Search } from 'lucide-react';
import { useSearchPalette } from '@/components/searchPalette';
import { normalizeBillKey } from '@/lib/format';
import { isApplePlatform } from '@/lib/platform';
import { ABOUT_PATH, billPath } from '@/lib/routes';
import { usePageTitle } from '@/lib/usePageTitle';
import { IncomeOverview } from '@/pages/Home/IncomeOverview';
import { RetrySection } from '@/pages/Home/RetrySection';
import { SearchResults } from '@/pages/Home/SearchResults';
import { TopicOverview } from '@/pages/Home/TopicOverview';

/** A search field in appearance, a button in fact: it opens the palette, which does the searching. */
function PaletteTrigger() {
  const [apple] = useState(isApplePlatform);
  const { open } = useSearchPalette();
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Search bills, clients and firms"
      aria-keyshortcuts={apple ? 'Meta+K' : 'Control+K'}
      className="flex h-12 w-full items-center gap-3 rounded-md border border-input bg-background px-4 text-base text-muted-foreground hover:border-ring hover:text-foreground"
    >
      <Search className="size-5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-left">Bill number, client or firm</span>
    </button>
  );
}

/**
 * Home: the search trigger, search results when the URL carries `?q=`, total
 * reported income by quarter, issue areas as a heatmap and a ranked list, and
 * one paragraph on what the data is and is not.
 */
export function HomePage() {
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') ?? '').trim();
  usePageTitle(q ? `Search: ${q}` : undefined);

  // A bill number pasted straight into the URL belongs on the bill page.
  const billKey = q ? normalizeBillKey(q) : null;
  if (billKey) return <Navigate to={billPath(billKey)} replace />;

  return (
    <div className="space-y-12">
      <section aria-labelledby="home-heading" className="max-w-2xl space-y-5 pt-6">
        <div className="space-y-2">
          <h1 id="home-heading" className="text-4xl sm:text-5xl">
            Who lobbies Congress
          </h1>
          <p className="text-lg text-muted-foreground">
            Who pays, who is paid, on what, and for how much, quarter by quarter, from the filings firms make under the
            Lobbying Disclosure Act.
          </p>
        </div>
        <PaletteTrigger />
        <p className="text-sm text-muted-foreground">
          Try a bill number such as H.R. 1, or part of a name such as Chamber. Every name on every page is a link.
        </p>
      </section>

      {q && <RetrySection>{(retry) => <SearchResults key={q} q={q} onRetry={retry} />}</RetrySection>}

      <section aria-labelledby="income-heading" className="space-y-4">
        <h2 id="income-heading" className="text-xl font-semibold tracking-tight">
          Reported income across every engagement
        </h2>
        <RetrySection>{(retry) => <IncomeOverview onRetry={retry} />}</RetrySection>
      </section>

      <section aria-labelledby="topics-heading" className="space-y-4">
        <h2 id="topics-heading" className="text-xl font-semibold tracking-tight">
          Where the money goes, by issue area
        </h2>
        <RetrySection>{(retry) => <TopicOverview onRetry={retry} />}</RetrySection>
      </section>

      <section aria-labelledby="data-heading" className="max-w-3xl space-y-3 border-t border-border pt-6">
        <h2 id="data-heading" className="text-xl font-semibold tracking-tight">
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
          <Link to={ABOUT_PATH} className="font-medium text-primary underline-offset-4 hover:underline">
            Read more about the data
          </Link>
        </p>
      </section>
    </div>
  );
}
