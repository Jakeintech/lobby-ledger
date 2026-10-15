import { TableHead, cn } from '@databricks/appkit-ui/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { SortState } from '@/pages/Bills/sort';

export interface SortHeadProps<K extends string> {
  sortKey: K;
  label: string;
  sort: SortState<K>;
  onSort: (key: K) => void;
  className?: string;
}

/**
 * A column header that sorts. The same control EngagementTable keeps
 * private, generalised over the column key so the bills and terms tables
 * can share it.
 */
export function SortHead<K extends string>({ sortKey, label, sort, onSort, className }: SortHeadProps<K>) {
  const isActive = sortKey === sort.key;
  const Icon = sort.direction === 'asc' ? ChevronUp : ChevronDown;
  return (
    <TableHead
      aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={className}
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
