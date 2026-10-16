import { useMemo } from 'react';
import { sql } from '@databricks/appkit-ui/js';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { PageState } from '@/components/PageState';
import { money, quarterLabel } from '@/lib/format';
import { latestSurge } from '@/pages/Client/signals';

export interface SurgeMarkProps {
  kind: 'client' | 'firm';
  id: string;
  onRetry: () => void;
}

/**
 * One short line in the event amber when the newest quarter's income is a
 * surge: at least two standard deviations above, and at least half again,
 * the mean of the prior quarters, with three or more of them available.
 * Nothing otherwise. The z-score and the figures are Gold's; the rise rule
 * is the one Home applies, so the two agree. The firm page shares it.
 */
export function SurgeMark({ kind, id, onRetry }: SurgeMarkProps) {
  const params = useMemo(() => ({ kind: sql.string(kind), id: sql.string(id) }), [kind, id]);
  const { data, loading, error } = useAnalyticsQuery('surge_for', params);
  const surge = useMemo(() => latestSurge(data ?? []), [data]);
  if (loading) return null;
  if (error) {
    return (
      <PageState loading={false} error={error} empty={false} emptyMessage="" onRetry={onRetry}>
        {null}
      </PageState>
    );
  }
  if (!surge?.is_surge) return null;
  const deviations = surge.z === null ? '' : `, ${surge.z.toFixed(1)} standard deviations above`;
  return (
    <p className="border-l-2 pl-3 text-sm" style={{ borderColor: 'var(--event)' }}>
      <span className="font-medium text-foreground">Income surged in {quarterLabel(surge.period_end_date)}:</span>{' '}
      {money(surge.income)} reported{deviations} the prior average of {money(surge.mean_prior)} a quarter.
    </p>
  );
}
