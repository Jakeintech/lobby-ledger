import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button, Input, cn } from '@databricks/appkit-ui/react';
import { Search } from 'lucide-react';
import { normalizeBillKey } from '@/lib/format';
import { billPath, searchPath } from '@/lib/routes';

export interface SearchBoxProps {
  /**
   * Called with the trimmed text when it is not a bill number. When omitted
   * the box navigates to Home with the text in the query string.
   */
  onSearch?: (q: string) => void;
  initialValue?: string;
  placeholder?: string;
  /** Label for the input, visually hidden but read by screen readers. */
  label?: string;
  className?: string;
  /** Larger input for the Home page. */
  size?: 'default' | 'large';
}

/**
 * One box for two kinds of search. A bill number in any spelling (`h.r. 1`,
 * `HR1`, `S. 1477`) goes straight to the bill page; anything else is a
 * client or firm name search.
 */
export function SearchBox({
  onSearch,
  initialValue = '',
  placeholder = 'Bill number, client or firm',
  label = 'Search bills, clients and firms',
  className,
  size = 'default',
}: SearchBoxProps) {
  const navigate = useNavigate();
  const inputId = useId();
  const [value, setValue] = useState(initialValue);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = value.trim();
    if (!q) return;
    const billKey = normalizeBillKey(q);
    if (billKey) {
      void navigate(billPath(billKey));
      return;
    }
    if (onSearch) {
      onSearch(q);
      return;
    }
    void navigate(searchPath(q));
  }

  const large = size === 'large';

  return (
    <form role="search" onSubmit={submit} className={cn('flex w-full min-w-0 items-center gap-2', className)}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <Input
        id={inputId}
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        className={cn('min-w-0 flex-1', large && 'h-11 text-base')}
      />
      <Button type="submit" size={large ? 'default' : 'sm'} aria-label="Search">
        <Search className="size-4" aria-hidden="true" />
        <span className={cn(large ? 'inline' : 'sr-only sm:not-sr-only')}>Search</span>
      </Button>
    </form>
  );
}
