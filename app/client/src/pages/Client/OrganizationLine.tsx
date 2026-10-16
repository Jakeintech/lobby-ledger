import { useMemo } from 'react';
import { Link } from 'react-router';
import { sql } from '@databricks/appkit-ui/js';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { EntityLink, LINK_CLASS } from '@/components/EntityLink';
import { PageState } from '@/components/PageState';
import { count, toNumber } from '@/lib/format';
import { organizationPath } from '@/lib/routes';
import { sameName, siblingFirms } from '@/pages/Client/signals';

export interface OrganizationLineProps {
  id: string;
  /** The client's name from the header, so the line does not repeat it when the organization carries the same one. */
  clientName: string;
  onRetry: () => void;
}

/**
 * One line under the client header: the organization this client row
 * belongs to, with the firms its other rows registered with. In LDA data a
 * client id belongs to one registrant, so an organization hired through
 * three firms is three client rows; Gold groups them by name. Renders
 * nothing while loading and when the organization has only this one row.
 */
export function OrganizationLine({ id, clientName, onRetry }: OrganizationLineProps) {
  const params = useMemo(() => ({ id: sql.string(id) }), [id]);
  const { data, loading, error } = useAnalyticsQuery('client_organization', params);
  const rows = useMemo(() => data ?? [], [data]);
  const firms = useMemo(() => siblingFirms(rows), [rows]);
  if (loading) return null;
  if (error) {
    return (
      <PageState loading={false} error={error} empty={false} emptyMessage="" onRetry={onRetry}>
        {null}
      </PageState>
    );
  }
  const header = rows[0];
  if (!header || toNumber(header.client_count) <= 1) return null;
  const others = toNumber(header.client_count) - 1;
  const rowsText = `${count(header.client_count)} client rows`;
  const href = organizationPath(header.organization_hk);
  // When the organization is named exactly as the client, the link sits on the count instead of repeating the h1.
  const lead = sameName(header.organization_name, clientName) ? (
    <>
      One of{' '}
      <Link to={href} className={LINK_CLASS}>
        {rowsText}
      </Link>{' '}
      under this name
    </>
  ) : (
    <>
      One of {rowsText} for{' '}
      <Link to={href} className={LINK_CLASS}>
        {header.organization_name}
      </Link>
    </>
  );
  if (firms.length === 0) {
    return <p className="text-sm">{lead}, all with the same firm.</p>;
  }
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
      <span>
        {lead}, also registered through {firms.length === 1 ? 'one other firm' : `${count(firms.length)} other firms`}
        {others !== firms.length ? ` across ${count(others)} other client rows` : ''}:
      </span>
      {firms.map((firm) => (
        <EntityLink key={firm.registrant_id} kind="firm" id={firm.registrant_id} name={firm.firm} />
      ))}
    </p>
  );
}
