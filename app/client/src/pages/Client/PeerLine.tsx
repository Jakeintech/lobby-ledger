import { Fragment, useMemo } from 'react';
import { sql } from '@databricks/appkit-ui/js';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { EntityLink } from '@/components/EntityLink';
import { PageState } from '@/components/PageState';
import { count } from '@/lib/format';
import { peerGroups } from '@/pages/Client/signals';
import type { PeerGroup } from '@/pages/Client/signals';

export interface PeerLineProps {
  kind: 'client' | 'firm';
  id: string;
  onRetry: () => void;
}

/** How many issue codes a group names before it says `and N more`. */
const CODES_SHOWN = 5;

/** Groups within this top share are spelled out; the rest fold into one closing count. */
const NAMED_TOP = 10;

/** `TRD`, `ECN and MAN`, `3 issues (APP, TAX and TRD)` or `18 issues (TRD, FOR, IND, FUE, APP and 13 more)`, each code a link. */
function GroupCodes({ group }: { group: PeerGroup }) {
  const shown = group.codes.slice(0, CODES_SHOWN);
  const more = group.codes.length - shown.length;
  const links = shown.map((code, i) => {
    const last = i === shown.length - 1;
    const separator = i === 0 ? '' : last && more === 0 ? ' and ' : ', ';
    return (
      <Fragment key={code}>
        {separator}
        <EntityLink kind="topic" id={code} />
      </Fragment>
    );
  });
  if (group.codes.length <= 2) return <>{links}</>;
  return (
    <>
      {count(group.codes.length)} issues ({links}
      {more > 0 ? ` and ${count(more)} more` : ''})
    </>
  );
}

/**
 * One sentence of percentiles: where this entity's income on each issue code
 * ranks among every client, or every firm, that reported on that code. Gold
 * ranks by income within the code; the sentence groups the codes by top
 * share, names up to five per group within the top tenth, counts the rest
 * in one clause and links each code to its topic page. The firm page shares
 * it.
 */
export function PeerLine({ kind, id, onRetry }: PeerLineProps) {
  const params = useMemo(() => ({ kind: sql.string(kind), id: sql.string(id) }), [kind, id]);
  const { data, loading, error } = useAnalyticsQuery('peer_ranks', params);
  const groups = useMemo(() => peerGroups(data ?? []), [data]);
  if (loading) return null;
  if (error) {
    return (
      <PageState loading={false} error={error} empty={false} emptyMessage="" onRetry={onRetry}>
        {null}
      </PageState>
    );
  }
  if (groups.length === 0) return null;
  const peers = kind === 'client' ? 'clients' : 'firms';
  const measure = kind === 'client' ? 'spending' : 'income';
  const named = groups.filter((group) => group.top <= NAMED_TOP);
  const rest = groups.filter((group) => group.top > NAMED_TOP).reduce((n, group) => n + group.codes.length, 0);
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">
        Among {peers} by reported {measure} on an issue, 2024 to 2025:{' '}
      </span>
      {named.map((group, i) => (
        <Fragment key={group.share}>
          {i > 0 && '; '}
          {group.share} on <GroupCodes group={group} />
        </Fragment>
      ))}
      {rest > 0 && (
        <span className="text-muted-foreground">
          {named.length > 0 ? '; and ' : ''}
          {named.length > 0
            ? `${count(rest)} more ${rest === 1 ? 'issue' : 'issues'}`
            : `${count(rest)} ${rest === 1 ? 'issue' : 'issues'}`}{' '}
          outside the top {NAMED_TOP}%
        </span>
      )}
      .
    </p>
  );
}
