import { TableHead, cn } from '@databricks/appkit-ui/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { SortState } from '@/pages/Lobbyist/sort';

export interface SortHeadProps<K extends string> {
  sortKey: K;
  label: string;
  sort: SortState<K>;
  onSort: (key: K) => void;
  className?: string;
  /** Right-aligns the button for numeric columns. */
  align?: 'left' | 'right';
}

/** A column header that is a real button, with the sort direction announced through `aria-sort`. */
export function SortHead<K extends string>({
  sortKey,
  label,
  sort,
  onSort,
  className,
  align = 'left',
}: SortHeadProps<K>) {
  const isActive = sort.key === sortKey;
  const Icon = sort.direction === 'asc' ? ChevronUp : ChevronDown;
  return (
    <TableHead
      aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(align === 'right' && 'text-right', className)}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 rounded-sm font-medium hover:text-foreground',
          isActive ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {label}
        <Icon className={cn('size-3.5', !isActive && 'invisible')} aria-hidden="true" />
      </button>
    </TableHead>
  );
}
