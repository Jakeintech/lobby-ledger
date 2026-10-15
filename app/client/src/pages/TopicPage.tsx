import { useParams } from 'react-router';
import { usePageTitle } from '@/lib/usePageTitle';

/** Placeholder until the topic queries exist. */
export function TopicPage() {
  const { code = '' } = useParams();
  const issueCode = code.toUpperCase();
  usePageTitle(issueCode);
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{issueCode} lobbying</h1>
      <p className="text-muted-foreground">
        Income by quarter, top clients and firms, and the bills cited for this issue.
      </p>
    </section>
  );
}
