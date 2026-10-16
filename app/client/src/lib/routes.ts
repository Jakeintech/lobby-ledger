/**
 * Route path builders. Every link in the app goes through these so that ids
 * and names with `&`, `/` or spaces are encoded once, in one place.
 */

export const HOME_PATH = '/';
export const ABOUT_PATH = '/about';
export const BILLS_PATH = '/bills';
export const TRENDS_PATH = '/trends';
export const FOREIGN_PATH = '/foreign';
export const LOBBIED_PATH = '/lobbied';
export const REVOLVING_DOOR_PATH = '/revolving-door';
/** The id of Home's issue-area section, which the header's Topics link scrolls to. */
export const TOPICS_ANCHOR = 'topics';

/** Route patterns for the router. Builders below produce concrete paths. */
export const ROUTE_PATTERNS = {
  home: HOME_PATH,
  topic: '/topic/:code',
  bill: '/bill/:key',
  bills: BILLS_PATH,
  billInCongress: '/bill/:congress/:key',
  client: '/client/:id',
  firm: '/firm/:id',
  lobbyist: '/lobbyist/:id',
  trends: TRENDS_PATH,
  trend: '/trend/:term',
  foreign: FOREIGN_PATH,
  foreignCountry: '/foreign/:country',
  lobbied: LOBBIED_PATH,
  lobbiedEntity: '/lobbied/:id',
  revolvingDoor: REVOLVING_DOOR_PATH,
  about: ABOUT_PATH,
  organization: '/organization/:id',
} as const;

/** Home scrolled to the issue-area section. */
export function topicsAnchorPath(): string {
  return `${HOME_PATH}#${TOPICS_ANCHOR}`;
}

export function billsPath(): string {
  return BILLS_PATH;
}

/** A bill within one Congress, for example `/bill/119/HR1`. */
export function billInCongressPath(congress: string | number, key: string): string {
  return `/bill/${encodeURIComponent(String(congress))}/${encodeURIComponent(key)}`;
}

export function trendsPath(): string {
  return TRENDS_PATH;
}

/** A curated term as `gold.term` spells it, lower case, for example `tax credit`. */
export function trendPath(term: string): string {
  return `/trend/${encodeURIComponent(term)}`;
}

export function revolvingDoorPath(): string {
  return REVOLVING_DOOR_PATH;
}

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

export function foreignPath(): string {
  return FOREIGN_PATH;
}

/** A country as `gold.foreign_country` names it, for example `Japan` or `United Arab Emirates`. */
export function foreignCountryPath(country: string): string {
  return `/foreign/${encodeURIComponent(country)}`;
}

export function lobbiedPath(): string {
  return LOBBIED_PATH;
}

/** `id` is the government entity's `entity_hk`. */
export function lobbiedEntityPath(id: string | number): string {
  return `/lobbied/${encodeURIComponent(String(id))}`;
}

/** Home with a search term in the query string, for searches started from another page. */
export function searchPath(q: string): string {
  const trimmed = q.trim();
  return trimmed ? `/?q=${encodeURIComponent(trimmed)}` : HOME_PATH;
}

/** `id` is the organization's `organization_hk`, the hash of its normalized name. */
export function organizationPath(id: string | number): string {
  return `/organization/${encodeURIComponent(String(id))}`;
}
