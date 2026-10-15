import { toNumber } from '@/lib/format';
import { lobbiedEntityPath } from '@/lib/routes';
import type { RankedEntityRow } from '@/pages/Lobbied/RankedEntityList';

/** One row of `government_entities`. */
export interface GovernmentEntityRow {
  entity_hk: string;
  entity_name: string;
  engagement_count: number | string;
  client_count: number | string;
  firm_count: number | string;
  income: number | string;
  rank: number | string;
  /** `House`, `Senate`, `White House` or `Agency` as Gold classifies the entity. */
  chamber_or_agency: string | null;
}

export interface EntityGroup {
  /** The Gold value, for example `House`. */
  key: string;
  /** The heading, for example `House of Representatives`. */
  title: string;
  /** What the group holds, for the subtitle. */
  description: string;
  rows: RankedEntityRow[];
}

/** The four groups Gold assigns, in the order the page shows them; anything else follows under its own value. */
const KNOWN_GROUPS: ReadonlyArray<Omit<EntityGroup, 'rows'>> = [
  {
    key: 'House',
    title: 'House of Representatives',
    description: 'Members, committees and offices of the House',
  },
  { key: 'Senate', title: 'Senate', description: 'Senators, committees and offices of the Senate' },
  {
    key: 'White House',
    title: 'White House',
    description: 'The Executive Office of the President and its offices',
  },
  { key: 'Agency', title: 'Agencies', description: 'Executive departments, agencies and commissions' },
];

/** Shows a plain title for a group value Gold has not named before, so no entity is dropped. */
function describe(key: string): Omit<EntityGroup, 'rows'> {
  return (
    KNOWN_GROUPS.find((group) => group.key === key) ?? {
      key,
      title: key.trim() || 'Other',
      description: 'Entities Gold did not classify as House, Senate, White House or agency',
    }
  );
}

/**
 * Splits the entities by chamber or agency, each group ranked by income
 * descending. The known groups come first in their fixed order; unknown
 * values follow in alphabetical order; empty groups are left out.
 */
export function groupEntities(rows: GovernmentEntityRow[]): EntityGroup[] {
  const byKey = new Map<string, RankedEntityRow[]>();
  for (const row of rows) {
    const key = row.chamber_or_agency?.trim() || 'Other';
    const list = byKey.get(key) ?? [];
    list.push({
      id: row.entity_hk,
      name: row.entity_name,
      income: toNumber(row.income),
      engagements: toNumber(row.engagement_count),
      href: lobbiedEntityPath(row.entity_hk),
    });
    byKey.set(key, list);
  }
  const knownKeys = KNOWN_GROUPS.map((group) => group.key);
  const order = [...knownKeys, ...[...byKey.keys()].filter((key) => !knownKeys.includes(key)).sort()];
  return order
    .filter((key) => (byKey.get(key)?.length ?? 0) > 0)
    .map((key) => ({
      ...describe(key),
      rows: [...(byKey.get(key) ?? [])].sort((a, b) => b.income - a.income || a.name.localeCompare(b.name)),
    }));
}
