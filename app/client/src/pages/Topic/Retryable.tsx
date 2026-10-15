import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Skeleton } from '@databricks/appkit-ui/react';

/** Long enough for the analytics store to drop the old request entry before a section mounts again. */
const REMOUNT_DELAY_MS = 50;

/**
 * Re-runs a section's queries on demand. The analytics hook has no refetch:
 * its request entry lives until the last subscriber unmounts and is dropped
 * one tick later, so a retry unmounts the section, waits, and mounts it again.
 */
export function Retryable({
  children,
  skeleton,
}: {
  children: (retry: () => void) => ReactNode;
  skeleton?: ReactNode;
}) {
  const [paused, setPaused] = useState(false);
  const retry = useCallback(() => setPaused(true), []);
  useEffect(() => {
    if (!paused) return;
    const timer = setTimeout(() => setPaused(false), REMOUNT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [paused]);
  if (paused) return <>{skeleton ?? <SectionSkeleton />}</>;
  return <>{children(retry)}</>;
}

/** Placeholder for a chart or list section while it loads or remounts. */
export function SectionSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

/** Placeholder for the page title, its one-line summary and four stat tiles. */
export function HeaderSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-80 max-w-full" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[1, 2, 3, 4].map((n) => (
          <Skeleton key={n} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
