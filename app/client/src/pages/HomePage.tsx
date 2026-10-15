import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router';
import { Search } from 'lucide-react';
import { useSearchPalette } from '@/components/searchPalette';
import { normalizeBillKey } from '@/lib/format';
import { isApplePlatform } from '@/lib/platform';
import { LINK_CLASS } from '@/components/EntityLink';
import { SLICE_NOTE } from '@/components/Layout';
import { ABOUT_PATH, TOPICS_ANCHOR, billPath } from '@/lib/routes';
import { usePageTitle } from '@/lib/usePageTitle';
import { ConnectedRows } from '@/pages/Home/ConnectedRows';
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
 * The router does not scroll to a hash on client-side navigation, so the
 * header's Topics link needs this to land on the issue-area section. Keyed
 * on the location so clicking the link again from Home scrolls again.
 */
function useScrollToHash() {
  const { hash, key } = useLocation();
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash, key]);
}

/**
 * Home: the search trigger, search results when the URL carries `?q=`, total
 * reported income by quarter, issue areas as a heatmap and a ranked list,
 * three short rankings from the term, foreign and government entity tables,
 * and one paragraph on what the data is and is not.
 */
export function HomePage() {
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') ?? '').trim();
  usePageTitle(q ? `Search: ${q}` : undefined);
  useScrollToHash();

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

      <section id={TOPICS_ANCHOR} aria-labelledby="topics-heading" className="scroll-mt-24 space-y-4">
        <h2 id="topics-heading" className="text-xl font-semibold tracking-tight">
          Where the money goes, by issue area
        </h2>
        <RetrySection>{(retry) => <TopicOverview onRetry={retry} />}</RetrySection>
      </section>

      <section aria-labelledby="connected-heading" className="space-y-4">
        <h2 id="connected-heading" className="text-xl font-semibold tracking-tight">
          Terms, countries and offices in the filings
        </h2>
        <ConnectedRows />
      </section>

      <section aria-labelledby="data-heading" className="max-w-3xl space-y-3 border-t border-border pt-6">
        <h2 id="data-heading" className="text-xl font-semibold tracking-tight">
          What this data is
        </h2>
        <p className="text-muted-foreground">
          {SLICE_NOTE} The filings come from the U.S. Senate Lobbying Disclosure Act database. Reported income is the
          amount the firm disclosed receiving from the client for the quarter: it is rounded by the filer, it is $0 on
          registrations and on reports that leave the field blank, and it counts in full toward every issue listed on
          the filing. Bill records from Congress.gov, foreign funding and the government entities contacted load after
          the filings, so those pages fill in last.
        </p>
        <p>
          <Link to={ABOUT_PATH} className={LINK_CLASS}>
            Read more about the data
          </Link>
        </p>
      </section>
    </div>
  );
}
