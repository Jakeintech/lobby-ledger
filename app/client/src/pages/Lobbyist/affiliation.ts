/**
 * Helpers for `gold.lobbyist_affiliation` rows: the committees, members of
 * Congress and agencies matched by text from a lobbyist's disclosed covered
 * positions. Shared by the lobbyist page and the revolving door list.
 */

export type Confidence = 'high' | 'medium';

/** `gold.lobbyist_affiliation.kind` values as the SQL spells them. */
const KIND_WORDS: Record<string, string> = {
  committee: 'committee',
  member: 'member of Congress',
  agency: 'agency',
};

/**
 * `member` becomes `Member of Congress`; the revolving door list joins kinds
 * as `committee, member`, which becomes `Committee and member of Congress`.
 * Unknown kinds pass through in sentence case.
 */
export function kindLabel(kind: string | null | undefined): string {
  const words = (kind ?? '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .map((part) => KIND_WORDS[part] ?? part);
  if (words.length === 0) return 'Affiliation';
  const joined = words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

/** Reads the confidence column, which is `high`, `medium`, or missing when a query does not carry it. */
export function toConfidence(value: string | null | undefined): Confidence | null {
  const text = (value ?? '').trim().toLowerCase();
  return text === 'high' || text === 'medium' ? text : null;
}

/** What each confidence level means, in the words the matching rules use. */
export function confidenceLabel(confidence: Confidence | null): string {
  switch (confidence) {
    case 'high':
      return 'exact name match';
    case 'medium':
      return 'partial name match';
    default:
      return 'match confidence not recorded';
  }
}

/** True for a Gold entity hash (an md5 hex string), the only `ref_id` with a page of its own. */
export function isEntityHash(id: string | null | undefined): boolean {
  return /^[0-9a-f]{32}$/i.test((id ?? '').trim());
}
