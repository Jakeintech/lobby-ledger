import { useParams } from 'react-router';
import { usePageTitle } from '@/lib/usePageTitle';

/** Placeholder until the lobbyist queries exist. */
export function LobbyistPage() {
  const { id = '' } = useParams();
  usePageTitle(`Lobbyist ${id}`);
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Lobbyist {id}</h1>
      <p className="text-muted-foreground">
        Quarters active per client, the firms they appear with, and any covered government positions disclosed.
      </p>
    </section>
  );
}
