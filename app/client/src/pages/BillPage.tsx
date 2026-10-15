import { useParams } from 'react-router';
import { billLabel, normalizeBillKey } from '@/lib/format';
import { usePageTitle } from '@/lib/usePageTitle';

/** Placeholder until the bill queries exist. */
export function BillPage() {
  const { key = '' } = useParams();
  const billKey = normalizeBillKey(key) ?? key;
  const label = billLabel(billKey);
  usePageTitle(label);
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{label}</h1>
      <p className="text-muted-foreground">
        Filings that mention this bill by quarter, and the engagements lobbying on it.
      </p>
    </section>
  );
}
