import { describe, expect, it } from 'vitest';
import { groupEntities } from '@/pages/Lobbied/groups';
import type { GovernmentEntityRow } from '@/pages/Lobbied/groups';

function row(overrides: Partial<GovernmentEntityRow> & { entity_hk: string }): GovernmentEntityRow {
  return {
    entity_name: overrides.entity_hk.toUpperCase(),
    engagement_count: '1',
    client_count: '1',
    firm_count: '1',
    income: '0',
    rank: '1',
    chamber_or_agency: 'Agency',
    ...overrides,
  };
}

describe('groupEntities', () => {
  it('keeps the House, Senate, White House, Agency order and drops empty groups', () => {
    const groups = groupEntities([
      row({ entity_hk: 'a', chamber_or_agency: 'Agency' }),
      row({ entity_hk: 'h', chamber_or_agency: 'House' }),
      row({ entity_hk: 'w', chamber_or_agency: 'White House' }),
    ]);
    expect(groups.map((group) => group.key)).toEqual(['House', 'White House', 'Agency']);
    expect(groups[0].title).toBe('House of Representatives');
  });

  it('ranks each group by income descending, reading decimal strings', () => {
    const groups = groupEntities([
      row({ entity_hk: 'low', chamber_or_agency: 'Senate', income: '1000.0' }),
      row({ entity_hk: 'high', chamber_or_agency: 'Senate', income: '250000.0', engagement_count: '12' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].rows.map((r) => r.id)).toEqual(['high', 'low']);
    expect(groups[0].rows[0]).toMatchObject({ income: 250000, engagements: 12, href: '/lobbied/high' });
  });

  it('puts unknown or missing classifications after the known groups under their own value', () => {
    const groups = groupEntities([
      row({ entity_hk: 'x', chamber_or_agency: 'Judiciary' }),
      row({ entity_hk: 'n', chamber_or_agency: null }),
      row({ entity_hk: 's', chamber_or_agency: 'Senate' }),
    ]);
    expect(groups.map((group) => group.key)).toEqual(['Senate', 'Judiciary', 'Other']);
    expect(groups[1].title).toBe('Judiciary');
  });
});
