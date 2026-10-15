import type { ReactNode } from 'react';
import { Link } from 'react-router';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Skeleton,
} from '@databricks/appkit-ui/react';
import { Inbox, TriangleAlert } from 'lucide-react';
import { HOME_PATH } from '@/lib/routes';

export interface PageStateProps {
  loading: boolean;
  error: string | null;
  /** True when the query finished with no rows. */
  empty: boolean;
  /** Why the section is empty, in one sentence. */
  emptyMessage: string;
  onRetry: () => void;
  children: ReactNode;
  /** Heading for the empty state. */
  emptyTitle?: string;
  /** Heading for the error alert. */
  errorTitle?: string;
  /** A custom skeleton that matches the section's shape. */
  skeleton?: ReactNode;
  /** Where the empty state's link goes. Defaults to Home. */
  backHref?: string;
  backLabel?: string;
}

function DefaultSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

/**
 * Wraps one page section. Loading shows a skeleton, an error shows the
 * message with a retry, an empty result says why and offers a way back,
 * and otherwise the children render.
 */
export function PageState({
  loading,
  error,
  empty,
  emptyMessage,
  onRetry,
  children,
  emptyTitle = 'Nothing to show',
  errorTitle = 'The query failed',
  skeleton,
  backHref = HOME_PATH,
  backLabel = 'Back to Home',
}: PageStateProps) {
  if (loading) return <>{skeleton ?? <DefaultSkeleton />}</>;

  if (error) {
    return (
      <Alert variant="destructive">
        <TriangleAlert className="size-4" />
        <AlertTitle>{errorTitle}</AlertTitle>
        <AlertDescription className="space-y-3">
          <p className="break-words">{error}</p>
          <div>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (empty) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Inbox />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyMessage}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline" size="sm">
            <Link to={backHref}>{backLabel}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return <>{children}</>;
}
