import { useParams } from 'react-router';
import { usePageTitle } from '@/lib/usePageTitle';

/** Placeholder until the client queries exist. */
export function ClientPage() {
  const { id = '' } = useParams();
  usePageTitle(`Client ${id}`);
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Client {id}</h1>
      <p className="text-muted-foreground">
        Income reported on this client by quarter, the firms it hired and the lobbyists listed.
      </p>
    </section>
  );
}
