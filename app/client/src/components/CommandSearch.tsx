import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { sql } from '@databricks/appkit-ui/js';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandDialog,
  useAnalyticsQuery,
} from '@databricks/appkit-ui/react';
import { Building2, FileText, Landmark, Search } from 'lucide-react';
import { billLabel, money, normalizeBillKey } from '@/lib/format';
import { billPath, clientPath, firmPath, searchPath } from '@/lib/routes';

export interface CommandSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEBOUNCE_MS = 200;
const MIN_QUERY = 2;

function useDebounced(value: string): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value]);
  return debounced;
}

interface EntityMatchesProps {
  q: string;
  onPick: (path: string) => void;
}

/** The fallback item: every match for the text on Home. */
function SearchHomeItem({ q, onPick }: EntityMatchesProps) {
  return (
    <CommandGroup heading="Search">
      <CommandItem value={`search:${q}`} onSelect={() => onPick(searchPath(q))}>
        <Search aria-hidden="true" />
        <span>Show every match for &ldquo;{q}&rdquo; on Home</span>
      </CommandItem>
    </CommandGroup>
  );
}

/**
 * Clients and firms whose name contains the text, from the search_entities
 * query. The Home search item mounts after the results so that the first
 * result is the highlighted item and Enter opens it.
 */
function EntityMatches({ q, onPick }: EntityMatchesProps) {
  const params = useMemo(() => ({ q: sql.string(q) }), [q]);
  const { data, loading, error } = useAnalyticsQuery('search_entities', params);
  const rows = data ?? [];

  if (loading) {
    return <p className="px-3 py-2 text-sm text-muted-foreground">Searching the filings for &ldquo;{q}&rdquo;.</p>;
  }
  if (error) return <p className="px-3 py-2 text-sm text-destructive">The search failed. Close and try again.</p>;

  return (
    <>
      {rows.length > 0 ? (
        <CommandGroup heading="Clients and firms">
          {rows.map((row) => {
            const isFirm = row.kind === 'firm';
            const Icon = isFirm ? Building2 : Landmark;
            const path = isFirm ? firmPath(row.id) : clientPath(row.id);
            return (
              <CommandItem key={`${row.kind}-${row.id}`} value={`${row.kind}:${row.id}`} onSelect={() => onPick(path)}>
                <Icon aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                <span className="text-xs text-muted-foreground">{isFirm ? 'Firm' : 'Client'}</span>
                <span className="tabular-nums text-muted-foreground">{money(row.total_income, { compact: true })}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      ) : (
        <p className="px-3 py-2 text-sm text-muted-foreground">No client or firm name contains &ldquo;{q}&rdquo;.</p>
      )}
      <SearchHomeItem q={q} onPick={onPick} />
    </>
  );
}

/**
 * The command palette, opened with Command K or Control K. A bill number in
 * any spelling offers the bill page; anything else lists matching clients and
 * firms; Enter opens the highlighted result.
 */
export function CommandSearch({ open, onOpenChange }: CommandSearchProps) {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const debounced = useDebounced(value);
  const q = value.trim();
  const billKey = normalizeBillKey(q);
  const searchable = !billKey && debounced.trim().length >= MIN_QUERY;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpenChange]);

  function handleOpenChange(next: boolean) {
    if (!next) setValue('');
    onOpenChange(next);
  }

  function go(path: string) {
    handleOpenChange(false);
    void navigate(path);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Search"
      description="Type a bill number, or part of a client or firm name"
      showCloseButton={false}
    >
      {/*
       * CommandDialog (appkit-ui 0.84, ui/command.d.ts) takes only Dialog
       * props plus title, description, className and showCloseButton, with
       * no pass-through to the Command it wraps, so this inner Command is
       * the only place shouldFilter, loop and the label can be set. The
       * outer root never sees typed input and stays inert.
       */}
      <Command shouldFilter={false} label="Search bills, clients and firms" loop>
        <CommandInput value={value} onValueChange={setValue} placeholder="Bill number, client or firm" />
        <CommandList>
          {q.length === 0 && (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Try a bill number such as H.R. 1, or part of a name such as Chamber.
            </p>
          )}
          {billKey && (
            <CommandGroup heading="Bill">
              <CommandItem value={`bill:${billKey}`} onSelect={() => go(billPath(billKey))}>
                <FileText aria-hidden="true" />
                <span>Go to {billLabel(billKey)}</span>
              </CommandItem>
            </CommandGroup>
          )}
          {searchable && <EntityMatches q={debounced.trim()} onPick={go} />}
          {q.length > 0 && q.length < MIN_QUERY && !billKey && (
            <CommandEmpty>Type at least {MIN_QUERY} characters to search names.</CommandEmpty>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
