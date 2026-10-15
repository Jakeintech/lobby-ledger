import { useParams } from 'react-router';
import { usePageTitle } from '@/lib/usePageTitle';

/** Placeholder until the firm queries exist. */
export function FirmPage() {
  const { id = '' } = useParams();
  usePageTitle(`Firm ${id}`);
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Firm {id}</h1>
      <p className="text-muted-foreground">
        Income by quarter across every client, the clients ranked, and the roster of lobbyists.
      </p>
    </section>
  );
}
