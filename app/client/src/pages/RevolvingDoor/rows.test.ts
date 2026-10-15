import { describe, expect, it } from 'vitest';
import { normalizeRows, splitCodes, summarize, toFlag } from './rows';
import type { RawRevolvingDoorRow } from './rows';

function raw(overrides: Partial<RawRevolvingDoorRow> = {}): RawRevolvingDoorRow {
  return {
    lobbyist_id: '68995',
    engagement_hk: 'abc',
    full_name: 'Zachary Rudisill',
    kind: 'committee',
    ref_name: 'House Committee on Ways and Means',
    client_id: '64249',
    client: 'AMERICA WINS',
    registrant_id: '682',
    firm: 'AKIN GUMP STRAUSS HAUER & FELD',
    issue_codes: 'TAX, TRD',
    income: '250000.0',
    lobbies_former_employer: 'false',
    confidence: 'high',
    ...overrides,
  };
}

describe('toFlag', () => {
  it('reads booleans the warehouse sends as text', () => {
    expect(toFlag(true)).toBe(true);
    expect(toFlag('true')).toBe(true);
    expect(toFlag('TRUE')).toBe(true);
    expect(toFlag(1)).toBe(true);
    expect(toFlag('false')).toBe(false);
    expect(toFlag(0)).toBe(false);
  });

  it('returns null when the column is absent or unreadable', () => {
    expect(toFlag(null)).toBeNull();
    expect(toFlag(undefined)).toBeNull();
    expect(toFlag('maybe')).toBeNull();
  });
});

describe('normalizeRows', () => {
  it('coerces income, the flag and the confidence once', () => {
    const [row] = normalizeRows([raw()]);
    expect(row.income).toBe(250000);
    expect(row.lobbies_former_employer).toBe(false);
    expect(row.confidence).toBe('high');
    expect(row.full_name).toBe('Zachary Rudisill');
  });

  it('leaves the flag and confidence null when the query does not carry them', () => {
    const [row] = normalizeRows([raw({ lobbies_former_employer: undefined, confidence: undefined })]);
    expect(row.lobbies_former_employer).toBeNull();
    expect(row.confidence).toBeNull();
  });
});

describe('splitCodes', () => {
  it('splits and deduplicates comma separated issue codes', () => {
    expect(splitCodes('TAX, TRD, TAX')).toEqual(['TAX', 'TRD']);
    expect(splitCodes(null)).toEqual([]);
    expect(splitCodes('')).toEqual([]);
  });
});

describe('summarize', () => {
  it('counts distinct lobbyists, sums income once per engagement and counts the flagged', () => {
    const rows = normalizeRows([
      raw({ lobbyist_id: '1', engagement_hk: 'a', income: 100, lobbies_former_employer: true }),
      raw({ lobbyist_id: '1', engagement_hk: 'a', income: 100, kind: 'member', lobbies_former_employer: true }),
      raw({ lobbyist_id: '2', engagement_hk: 'b', income: 50, lobbies_former_employer: false }),
    ]);
    expect(summarize(rows)).toEqual({ lobbyists: 2, engagements: 2, income: 150, lobbyingFormerEmployer: 1 });
  });

  it('handles an empty list', () => {
    expect(summarize([])).toEqual({ lobbyists: 0, engagements: 0, income: 0, lobbyingFormerEmployer: 0 });
  });
});
