import { useCallback, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

/**
 * Sort state for a table with one active column. Clicking the active column
 * flips its direction; clicking another column starts it on `descFirst`'s
 * direction (figures descend, names ascend).
 */
export function useSort<K extends string>(
  initial: SortState<K>,
  descFirst: ReadonlyArray<K>
): { sort: SortState<K>; toggle: (key: K) => void } {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const toggle = useCallback(
    (key: K) => {
      setSort((current) =>
        current.key === key
          ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
          : { key, direction: descFirst.includes(key) ? 'desc' : 'asc' }
      );
    },
    [descFirst]
  );
  return { sort, toggle };
}

/** `sorted by income descending`, for a table caption. */
export function sortCaption<K extends string>(sort: SortState<K>, labels: Record<K, string>): string {
  return `sorted by ${labels[sort.key].toLowerCase()} ${sort.direction === 'asc' ? 'ascending' : 'descending'}`;
}
