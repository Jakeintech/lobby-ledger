import { Fragment, useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { Skeleton } from '@databricks/appkit-ui/react';

export interface RetrySectionProps {
  /** Renders the section; `retry` restarts every query mounted inside it. */
  children: (retry: () => void) => ReactNode;
  /** Shown for the instant between unmount and remount. */
  skeleton?: ReactNode;
}

/** Long enough for the request store's teardown timer (a zero-delay timeout) to fire. */
const REMOUNT_DELAY_MS = 50;

function DefaultSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

/**
 * `useAnalyticsQuery` shares one in-flight request per query and parameters
 * and offers no refetch, so a failed query is retried by unmounting the
 * section, letting the store drop the entry, and mounting it again under a
 * new key.
 */
export function RetrySection({ children, skeleton }: RetrySectionProps) {
  const [state, setState] = useState({ attempt: 0, mounted: true });

  const retry = useCallback(() => {
    setState((current) => ({ attempt: current.attempt, mounted: false }));
    window.setTimeout(() => {
      setState((current) => ({ attempt: current.attempt + 1, mounted: true }));
    }, REMOUNT_DELAY_MS);
  }, []);

  if (!state.mounted) return <>{skeleton ?? <DefaultSkeleton />}</>;
  return <Fragment key={state.attempt}>{children(retry)}</Fragment>;
}
