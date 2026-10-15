import { createContext, useContext } from 'react';

export interface SearchPalette {
  /** Opens the command palette that Layout mounts. */
  open: () => void;
}

/** Provided by Layout; a no-op outside it so a page still renders in isolation. */
export const SearchPaletteContext = createContext<SearchPalette>({ open: () => {} });

/** The palette opener, for buttons that look like a search field. */
export function useSearchPalette(): SearchPalette {
  return useContext(SearchPaletteContext);
}
