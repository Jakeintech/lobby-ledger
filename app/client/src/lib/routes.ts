/**
 * Route path builders. Every link in the app goes through these so that ids
 * and names with `&`, `/` or spaces are encoded once, in one place.
 */

export const HOME_PATH = '/';
export const ABOUT_PATH = '/about';

/** Route patterns for the router. Builders below produce concrete paths. */
export const ROUTE_PATTERNS = {
  home: HOME_PATH,
  topic: '/topic/:code',
  bill: '/bill/:key',
  client: '/client/:id',
  firm: '/firm/:id',
  lobbyist: '/lobbyist/:id',
  about: ABOUT_PATH,
} as const;

export function topicPath(code: string): string {
  return `/topic/${encodeURIComponent(code)}`;
}

export function billPath(key: string): string {
  return `/bill/${encodeURIComponent(key)}`;
}

export function clientPath(id: string | number): string {
  return `/client/${encodeURIComponent(String(id))}`;
}

export function firmPath(id: string | number): string {
  return `/firm/${encodeURIComponent(String(id))}`;
}

export function lobbyistPath(id: string | number): string {
  return `/lobbyist/${encodeURIComponent(String(id))}`;
}

/** Home with a search term in the query string, for searches started from another page. */
export function searchPath(q: string): string {
  const trimmed = q.trim();
  return trimmed ? `/?q=${encodeURIComponent(trimmed)}` : HOME_PATH;
}
