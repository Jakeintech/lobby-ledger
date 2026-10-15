import { Link } from 'react-router';
import { Button } from '@databricks/appkit-ui/react';
import { HOME_PATH } from '@/lib/routes';
import { usePageTitle } from '@/lib/usePageTitle';

export function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground">
        There is no page at this address. Try a topic, a bill or a search from Home.
      </p>
      <Button asChild variant="outline">
        <Link to={HOME_PATH}>Back to Home</Link>
      </Button>
    </section>
  );
}
