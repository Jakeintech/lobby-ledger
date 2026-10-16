import { describe, expect, it } from 'vitest';
import {
  dateLabel,
  daysText,
  latestSurge,
  peerGroups,
  sameName,
  shareText,
  siblingFirms,
  topShareText,
  weekdayCounts,
} from './signals';

describe('dateLabel', () => {
  it('reads the day, month and year from the ISO text', () => {
    expect(dateLabel('2025-04-21')).toBe('21 Apr 2025');
    expect(dateLabel('2026-01-05')).toBe('5 Jan 2026');
  });
  it('passes non-dates through and blanks null', () => {
    expect(dateLabel('soon')).toBe('soon');
    expect(dateLabel('2025-13-01')).toBe('2025-13-01');
    expect(dateLabel(null)).toBe('');
  });
});

describe('topShareText', () => {
  it('turns the percentile remainder into a whole top share', () => {
    expect(topShareText(1)).toBe('top 1%');
    expect(topShareText('1.0')).toBe('top 1%');
    expect(topShareText(0.99)).toBe('top 1%');
    expect(topShareText(0.95)).toBe('top 5%');
    expect(topShareText('0.7853358762449671')).toBe('top 22%');
    expect(topShareText(0.5)).toBe('top 50%');
  });
  it('clamps junk and the bottom to the range', () => {
    expect(topShareText(0)).toBe('top 100%');
    expect(topShareText(null)).toBe('top 100%');
    expect(topShareText(2)).toBe('top 1%');
  });
});

describe('latestSurge', () => {
  const rows = [
    { period_end_date: '2025-03-31', income: '1.64E7', mean_prior: '1.4155E7', z: '5.37', is_surge: 'true' },
    { period_end_date: '2025-12-31', income: '1.638E7', mean_prior: '1.511E7', z: '1.03', is_surge: 'false' },
    { period_end_date: '2024-12-31', income: '1.461E7', mean_prior: '1.4E7', z: '1.72', is_surge: 'false' },
  ];
  it('picks the newest quarter whatever the row order', () => {
    const surge = latestSurge(rows);
    expect(surge?.period_end_date).toBe('2025-12-31');
    expect(surge?.income).toBe(16380000);
    expect(surge?.z).toBeCloseTo(1.03);
    expect(surge?.is_surge).toBe(false);
  });
  it('coerces a text flag and keeps a null z', () => {
    const surge = latestSurge([
      { period_end_date: '2025-12-31', income: '80000.0', mean_prior: '40000.0', z: null, is_surge: 'true' },
    ]);
    expect(surge?.is_surge).toBe(true);
    expect(surge?.z).toBeNull();
  });
  it('does not call a near-flat quarter a surge even when Gold flags it', () => {
    const surge = latestSurge([
      { period_end_date: '2025-12-31', income: '150000.0', mean_prior: '145866.67', z: '12.5', is_surge: 'true' },
    ]);
    expect(surge?.is_surge).toBe(false);
    const rose = latestSurge([
      { period_end_date: '2025-12-31', income: '150000.0', mean_prior: '100000.0', z: '2.4', is_surge: 'true' },
    ]);
    expect(rose?.is_surge).toBe(true);
  });
  it('returns null for no rows', () => {
    expect(latestSurge([])).toBeNull();
  });
});

describe('peerGroups', () => {
  it('groups codes by top share, best share first and codes by income', () => {
    const groups = peerGroups([
      { issue_code: 'ECN', income: '500000.0', pct_rank: '0.985' },
      { issue_code: 'FOR', income: '8080000.0', pct_rank: '1.0' },
      { issue_code: 'TRD', income: '2.768E7', pct_rank: '1.0' },
      { issue_code: 'MAN', income: '400000.0', pct_rank: '0.99' },
      { issue_code: ' ', income: '1.0', pct_rank: '1.0' },
      { issue_code: 'TRD', income: '1.0', pct_rank: '0.5' },
    ]);
    expect(groups).toEqual([
      { share: 'top 1%', top: 1, codes: ['TRD', 'FOR', 'MAN'] },
      { share: 'top 2%', top: 2, codes: ['ECN'] },
    ]);
  });
  it('is empty for no rows', () => {
    expect(peerGroups([])).toEqual([]);
  });
});

describe('sameName', () => {
  it('ignores case and surrounding space, and never matches blanks', () => {
    expect(sameName('U.S. CHAMBER OF COMMERCE', ' u.s. chamber of commerce ')).toBe(true);
    expect(sameName('U.S. CHAMBER OF COMMERCE', 'U.S. CHAMBER OF COMMERCE INSTITUTE')).toBe(false);
    expect(sameName('', '')).toBe(false);
    expect(sameName(null, undefined)).toBe(false);
  });
});

describe('siblingFirms', () => {
  const header = { organization_hk: 'abc', organization_name: 'U.S. CHAMBER OF COMMERCE', client_count: '6' };
  it('lists the other rows firms once each, in rank order, without the client own firm', () => {
    const firms = siblingFirms([
      { ...header, registrant_id: '401105159', firm: 'FULCRUM PUBLIC AFFAIRS LLC', rank: '1', is_self: 'true' },
      { ...header, registrant_id: '36105', firm: 'DENTONS US LLP', rank: '4', is_self: 'false' },
      { ...header, registrant_id: '401104718', firm: 'HB STRATEGIES', rank: '2', is_self: 'false' },
      { ...header, registrant_id: '401104718', firm: 'HB STRATEGIES', rank: '3', is_self: 'false' },
      { ...header, registrant_id: '401105159', firm: 'FULCRUM PUBLIC AFFAIRS LLC', rank: '5', is_self: 'false' },
    ]);
    expect(firms).toEqual([
      { registrant_id: '401104718', firm: 'HB STRATEGIES' },
      { registrant_id: '36105', firm: 'DENTONS US LLP' },
    ]);
  });
  it('is empty when the client is the only row', () => {
    expect(siblingFirms([{ ...header, registrant_id: '682', firm: 'AKIN GUMP', rank: '1', is_self: true }])).toEqual(
      []
    );
  });
});

describe('weekdayCounts', () => {
  it('reads the seven columns in week order', () => {
    const counts = weekdayCounts({
      monday: '945',
      tuesday: '557',
      wednesday: '0',
      thursday: '4',
      friday: '726',
      saturday: '3',
      sunday: null,
    });
    expect(counts.map((c) => c.label)).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
    expect(counts.map((c) => c.count)).toEqual([945, 557, 0, 4, 726, 3, 0]);
  });
});

describe('shareText', () => {
  it('writes small shares to a tenth and larger ones whole', () => {
    expect(shareText(0)).toBe('0%');
    expect(shareText('0.00179')).toBe('0.2%');
    expect(shareText(0.0004)).toBe('0.1%');
    expect(shareText(0.25)).toBe('25%');
    expect(shareText(1)).toBe('100%');
  });
});

describe('daysText', () => {
  it('pluralizes', () => {
    expect(daysText(0)).toBe('0 days');
    expect(daysText('1')).toBe('1 day');
    expect(daysText(17)).toBe('17 days');
  });
});
