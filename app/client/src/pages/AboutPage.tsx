import { usePageTitle } from '@/lib/usePageTitle';

/** Placeholder until the About copy lands with the pages task. */
export function AboutPage() {
  usePageTitle('About the data');
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">About the data</h1>
      <p className="text-muted-foreground">
        Where the filings come from, what reported income and a quarter mean, and how the summaries are produced.
      </p>
    </section>
  );
}
