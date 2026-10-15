import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Button, Input, useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { Search } from 'lucide-react';
import { PageState } from '@/components/PageState';
import { HOME_PATH } from '@/lib/routes';
import { usePageTitle } from '@/lib/usePageTitle';
import { Retryable } from '@/pages/Topic/Retryable';
import { PhraseResults } from '@/pages/Trends/PhraseResults';
import { TermTable } from '@/pages/Trends/TermTable';
import { useDebounced } from '@/pages/Trends/useDebounced';

/** `terms` takes no parameters; one shared object keeps the hook's cache key stable. */
const NO_PARAMS: Record<string, never> = {};

/** The live search scans every filing's text, so it waits for typing to pause and for a phrase worth scanning. */
const DEBOUNCE_MS = 400;
const MIN_PHRASE = 3;

/**
 * Trends page: a search field that runs any phrase over the specific issues
 * text of every quarterly report, and the tracked terms as a sortable table.
 * The phrase lives in the query string so a search can be shared.
 */
export function TrendsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = (searchParams.get('q') ?? '').trim();
  const [value, setValue] = useState(initial);
  const debounced = useDebounced(value.trim(), DEBOUNCE_MS);
  const q = debounced.length >= MIN_PHRASE ? debounced : '';
  const inputId = useId();
  usePageTitle(q ? `Trend: ${q}` : 'Trends');

  // The debounced phrase goes to the query string too, so a URL copied after typing carries the search.
  useEffect(() => {
    if ((searchParams.get('q') ?? '').trim() === q) return;
    setSearchParams(q ? { q } : {}, { replace: true });
  }, [q, searchParams, setSearchParams]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    setSearchParams(trimmed ? { q: trimmed } : {}, { replace: true });
  }

  const tooShort = value.trim().length > 0 && value.trim().length < MIN_PHRASE;

  return (
    <div className="space-y-12">
      <header className="max-w-2xl space-y-5">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl">What the filings talk about</h1>
          <p className="text-muted-foreground">
            Every quarterly report describes its specific issues in free text. Search that text for any phrase to see
            how many filings mention it each quarter and who is paying, or open one of the tracked terms below.
          </p>
        </div>
        <form role="search" onSubmit={submit} className="flex w-full min-w-0 items-center gap-2">
          <label htmlFor={inputId} className="sr-only">
            Search the filing text for a phrase
          </label>
          <Input
            id={inputId}
            type="search"
            name="q"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="A phrase, such as tariff or tax credit"
            autoComplete="off"
            enterKeyHint="search"
            className="h-11 min-w-0 flex-1 text-base"
          />
          <Button type="submit" aria-label="Search">
            <Search className="size-4" aria-hidden="true" />
            <span>Search</span>
          </Button>
        </form>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {tooShort
            ? `Type at least ${MIN_PHRASE} characters to search.`
            : 'Matches any filing whose text contains the phrase, in any case. Results update as you type.'}
        </p>
      </header>

      {q && <Retryable>{(retry) => <PhraseResults key={q} q={q} onRetry={retry} />}</Retryable>}

      <section aria-labelledby="terms-heading" className="space-y-3">
        <div className="space-y-1">
          <h2 id="terms-heading" className="text-xl font-semibold tracking-tight">
            Tracked terms by reported income
          </h2>
          <p className="text-sm text-muted-foreground">
            A fixed list of phrases counted ahead of time across every quarterly report, 2024 to 2025. Income is the
            U.S. dollars reported on the filings that mention each term. Each term is a link.
          </p>
        </div>
        <Retryable>{(retry) => <TrackedTerms onRetry={retry} />}</Retryable>
      </section>
    </div>
  );
}

function TrackedTerms({ onRetry }: { onRetry: () => void }) {
  const { data, loading, error } = useAnalyticsQuery('terms', NO_PARAMS);
  const rows = data ?? [];
  return (
    <PageState
      loading={loading}
      error={error}
      empty={rows.length === 0}
      emptyTitle="No tracked terms yet"
      emptyMessage="The term table is built after the filings load and has no rows yet. The search above still works on the filing text."
      onRetry={onRetry}
      backHref={HOME_PATH}
    >
      <TermTable rows={rows} emptyMessage="No tracked term appears in any filing." />
    </PageState>
  );
}
