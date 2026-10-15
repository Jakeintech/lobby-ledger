import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { Button, Kbd, cn } from '@databricks/appkit-ui/react';
import { Moon, Search, Sun } from 'lucide-react';
import { ThemeProvider, useTheme } from 'next-themes';
import { CommandSearch } from '@/components/CommandSearch';
import { SearchPaletteContext } from '@/components/searchPalette';
import { isApplePlatform } from '@/lib/platform';
import { ABOUT_PATH, HOME_PATH } from '@/lib/routes';
import { PRODUCT_NAME } from '@/lib/usePageTitle';

export const TAGLINE = 'Who lobbies Congress, for whom, on what, and for how much, quarter by quarter.';
export const SOURCE_LINE = 'Source: U.S. Senate Lobbying Disclosure Act filings, 2024 to 2025.';

export interface LayoutProps {
  /** One line on when the data was last pulled, for example `Filings pulled 15 October 2026.` */
  freshness: string;
  children: ReactNode;
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {dark ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
    </Button>
  );
}

function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  const [apple] = useState(isApplePlatform);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Search bills, clients and firms"
      aria-keyshortcuts={apple ? 'Meta+K' : 'Control+K'}
      className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground sm:w-64"
    >
      <Search className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-left">Search</span>
      <Kbd className="hidden sm:inline-flex">{apple ? '⌘K' : 'Ctrl K'}</Kbd>
    </button>
  );
}

/**
 * Sticky header with the product name, the search trigger, the theme toggle
 * and the About link; the page; a footer with the source and freshness.
 * Owns the theme provider and the command palette so every page gets both,
 * and hands pages the palette opener through SearchPaletteContext.
 */
export function Layout({ freshness, children }: LayoutProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const open = useCallback(() => setSearchOpen(true), []);
  const palette = useMemo(() => ({ open }), [open]);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SearchPaletteContext value={palette}>
        <div className="flex min-h-screen flex-col bg-background text-foreground">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
          >
            Skip to content
          </a>
          <header className="sticky top-0 z-40 border-b border-border bg-background">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2.5">
              <Link to={HOME_PATH} className="shrink-0 rounded-sm font-serif text-xl text-foreground">
                {PRODUCT_NAME}
              </Link>
              <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                <SearchTrigger onOpen={open} />
                <ThemeToggle />
                <nav aria-label="Primary">
                  <NavLink
                    to={ABOUT_PATH}
                    className={({ isActive }) =>
                      cn(
                        'rounded-sm px-2 py-1.5 text-sm font-medium underline-offset-4 hover:underline',
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
          <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />

          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
            {children}
          </main>

          <footer className="border-t border-border">
            <div className="mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-x-6 gap-y-1 px-4 py-4 text-xs text-muted-foreground">
              <p>{SOURCE_LINE}</p>
              <p>{freshness}</p>
            </div>
          </footer>
        </div>
      </SearchPaletteContext>
    </ThemeProvider>
  );
}
