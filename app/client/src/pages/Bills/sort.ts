import { useCallback, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

/**
 * Sort state for a table: clicking the active column flips it, clicking
 * another column starts it descending when it is a figure and ascending
 * when it is a name.
 */
export function useSortState<K extends string>(
  initial: SortState<K>,
  descendingFirst: ReadonlyArray<K>
): [SortState<K>, (key: K) => void] {
  const [sort, setSort] = useState(initial);
  const toggle = useCallback(
    (key: K) =>
      setSort((current) =>
        current.key === key
          ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
          : { key, direction: descendingFirst.includes(key) ? 'desc' : 'asc' }
      ),
    [descendingFirst]
  );
  return [sort, toggle];
}

/** `sorted by income descending`, for the line above a table. */
export function sortNote<K extends string>(sort: SortState<K>, labels: Record<K, string>): string {
  return `sorted by ${labels[sort.key].toLowerCase()} ${sort.direction === 'asc' ? 'ascending' : 'descending'}`;
}
