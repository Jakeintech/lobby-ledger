import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { Button, Kbd, cn } from '@databricks/appkit-ui/react';
import { Moon, Search, Sun } from 'lucide-react';
import { ThemeProvider, useTheme } from 'next-themes';
import { CommandSearch } from '@/components/CommandSearch';
import { SearchPaletteContext } from '@/components/searchPalette';
import { isApplePlatform } from '@/lib/platform';
import {
  ABOUT_PATH,
  BILLS_PATH,
  FOREIGN_PATH,
  HOME_PATH,
  LOBBIED_PATH,
  REVOLVING_DOOR_PATH,
  TRENDS_PATH,
  topicsAnchorPath,
} from '@/lib/routes';
import { PRODUCT_NAME } from '@/lib/usePageTitle';

/** The header links, in reading order. Topics scrolls Home to its issue-area section. */
const NAV_LINKS: ReadonlyArray<{ label: string; to: string; end?: boolean }> = [
  { label: 'Topics', to: topicsAnchorPath(), end: true },
  { label: 'Bills', to: BILLS_PATH },
  { label: 'Trends', to: TRENDS_PATH },
  { label: 'Foreign', to: FOREIGN_PATH },
  { label: 'Lobbied', to: LOBBIED_PATH },
  { label: 'Revolving door', to: REVOLVING_DOOR_PATH },
  { label: 'About', to: ABOUT_PATH },
];

/**
 * The primary navigation. One row beside the product name at desktop width;
 * below that it takes its own row and scrolls sideways inside itself, so the
 * page never grows wider than the screen; a fade on the right edge shows
 * that the row continues.
 */
function PrimaryNav() {
  return (
    <nav
      aria-label="Primary"
      className="-mx-4 min-w-0 basis-[calc(100%+2rem)] overflow-x-auto px-4 [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] [scrollbar-width:none] lg:order-2 lg:mx-0 lg:min-w-0 lg:flex-1 lg:basis-auto lg:px-0 lg:[mask-image:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max items-center gap-1 pr-10 lg:w-auto lg:pr-0">
        {NAV_LINKS.map((link) => (
          <li key={link.to} className="shrink-0">
            <NavLink
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  'block whitespace-nowrap rounded-sm px-2 py-1.5 text-sm font-medium underline-offset-4 hover:underline',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )
              }
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export const TAGLINE = 'Who lobbies Congress, for whom, on what, and for how much, quarter by quarter.';
export const SOURCE_LINE = 'Source: U.S. Senate Lobbying Disclosure Act filings, 2024 to 2025.';
/** What the data covers, for empty states and the notes on Home and About. */
export const SLICE_NOTE =
  'Lobby Ledger covers every quarterly report and registration filed under the Lobbying Disclosure Act for 2024 and 2025, about 207,000 filings, with no income threshold.';

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
 * Sticky header with the product name, the primary navigation, the search
 * trigger and the theme toggle; the page; a footer with the source and freshness.
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
            <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
              <Link to={HOME_PATH} className="shrink-0 rounded-sm font-serif text-xl text-foreground lg:order-1">
                {PRODUCT_NAME}
              </Link>
              <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1 sm:gap-2 lg:order-3">
                <SearchTrigger onOpen={open} />
                <ThemeToggle />
              </div>
              <PrimaryNav />
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
