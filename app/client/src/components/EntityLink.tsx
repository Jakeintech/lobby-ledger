import { Link } from 'react-router';
import { cn } from '@databricks/appkit-ui/react';
import { billLabel } from '@/lib/format';
import { billPath, clientPath, firmPath, lobbyistPath, topicPath } from '@/lib/routes';

export type EntityKind = 'topic' | 'bill' | 'client' | 'firm' | 'lobbyist';

export interface EntityLinkProps {
  kind: EntityKind;
  /** The Gold key: issue code, bill key, client id, registrant id or lobbyist id. */
  id: string | number;
  /** Display text. Defaults to the id, or to the bill label for bills. */
  name?: string | null;
  className?: string;
}

const PATH_BUILDERS: Record<EntityKind, (id: string) => string> = {
  topic: topicPath,
  bill: billPath,
  client: clientPath,
  firm: firmPath,
  lobbyist: lobbyistPath,
};

/**
 * A link to an entity page. React escapes the name, so `AKIN GUMP STRAUSS
 * HAUER & FELD` renders as typed; the route builders encode the id.
 */
export function EntityLink({ kind, id, name, className }: EntityLinkProps) {
  const key = String(id);
  const text = name?.trim() || (kind === 'bill' ? billLabel(key) : key);
  return (
    <Link
      to={PATH_BUILDERS[kind](key)}
      className={cn(
        'font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring',
        className
      )}
    >
      {text}
    </Link>
  );
}
