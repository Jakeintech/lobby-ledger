import { SearchBox } from '@/components/SearchBox';
import { usePageTitle } from '@/lib/usePageTitle';

/** Placeholder until the home queries exist: the search box and one sentence. */
export function HomePage() {
  usePageTitle();
  return (
    <section className="mx-auto max-w-2xl space-y-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Who lobbies Congress</h1>
      <p className="text-muted-foreground">
        Start with a bill number such as H.R. 1, or the name of a client or lobbying firm.
      </p>
      <SearchBox size="large" />
    </section>
  );
}
