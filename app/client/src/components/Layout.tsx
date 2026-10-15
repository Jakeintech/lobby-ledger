import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { Separator, cn } from '@databricks/appkit-ui/react';
import { ABOUT_PATH, HOME_PATH } from '@/lib/routes';
import { PRODUCT_NAME } from '@/lib/usePageTitle';

export const TAGLINE = 'Who lobbies Congress, for whom, on what, and for how much, quarter by quarter.';
export const SOURCE_LINE = 'Source: U.S. Senate Lobbying Disclosure Act filings, 2024 to 2025.';

export interface LayoutProps {
  /** One line on when the data was last pulled, for example `Filings pulled 15 October 2026.` */
  freshness: string;
  /** The search box, mounted by the router so it can navigate. */
  search?: ReactNode;
  children: ReactNode;
}

/** Header with the product name, tagline, search and About link; footer with source and freshness. */
export function Layout({ freshness, search, children }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:outline-2 focus:outline-ring"
      >
        Skip to content
      </a>
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link
              to={HOME_PATH}
              className="text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-ring"
            >
              {PRODUCT_NAME}
            </Link>
            <p className="text-sm text-muted-foreground">{TAGLINE}</p>
          </div>
          <div className="flex min-w-0 items-center gap-3 sm:w-auto sm:max-w-md sm:flex-1">
            {search && <div className="min-w-0 flex-1">{search}</div>}
            <nav aria-label="Primary" className="shrink-0">
              <NavLink
                to={ABOUT_PATH}
                className={({ isActive }) =>
                  cn(
                    'shrink-0 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring',
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  )
                }
              >
                About
              </NavLink>
            </nav>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>

      <footer className="border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-muted-foreground">
          <p>{SOURCE_LINE}</p>
          <Separator className="my-2 w-12" />
          <p>{freshness}</p>
        </div>
      </footer>
    </div>
  );
}
