import { useEffect } from 'react';

export const PRODUCT_NAME = 'Lobby Ledger';

/** Sets the browser tab title for the current page and restores the product name on unmount. */
export function usePageTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} | ${PRODUCT_NAME}` : PRODUCT_NAME;
    return () => {
      document.title = PRODUCT_NAME;
    };
  }, [title]);
}
