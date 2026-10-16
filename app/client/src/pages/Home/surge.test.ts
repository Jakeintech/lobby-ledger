import { describe, expect, it } from 'vitest';
import { latestQuarterSurges, surgeKindLabel, surgeLinkKind, timesUsualText } from './surge';
import type { RawSurgeRow } from './surge';

function raw(overrides: Partial<RawSurgeRow> = {}): RawSurgeRow {
  return {
    kind: 'client',
    id: '56695',
    name: 'ADVENTIST HEALTH',
    period_end_date: '2025-12-31',
    income: '315601.0',
    mean_prior: '30037.29',
    z: '39.64',
    ...overrides,
  };
}

describe('latestQuarterSurges', () => {
  it('keeps only the most recent quarter and orders by z descending', () => {
    const rows = latestQuarterSurges([
      raw({ id: 'a', period_end_date: '2025-09-30', z: '997.1' }),
      raw({ id: 'b', period_end_date: '2025-12-31', z: '20.68' }),
      raw({ id: 'c', period_end_date: '2025-12-31', z: '174.81' }),
    ]);
    expect(rows.map((row) => row.id)).toEqual(['c', 'b']);
  });

  it('coerces the figures once and normalises the kind', () => {
    const [row] = latestQuarterSurges([raw({ kind: 'ISSUE', id: 'CIV' })]);
    expect(row.kind).toBe('issue');
    expect(row.income).toBe(315601);
    expect(row.meanPrior).toBeCloseTo(30037.29);
    expect(row.z).toBeCloseTo(39.64);
  });

  it('drops a quarter that barely rose, whatever its z', () => {
    const rows = latestQuarterSurges([
      raw({ id: 'flat', income: '150000.0', mean_prior: '145866.67', z: '12.5' }),
      raw({ id: 'small', income: '140000.0', mean_prior: '100000.0', z: '3.1' }),
      raw({ id: 'rose', income: '150000.0', mean_prior: '100000.0', z: '2.4' }),
      raw({ id: 'new', income: '1000.0', mean_prior: '0', z: '2.0' }),
    ]);
    expect(rows.map((row) => row.id)).toEqual(['rose', 'new']);
  });

  it('drops rows without a quarter end and handles an empty list', () => {
    expect(latestQuarterSurges([raw({ period_end_date: '' })])).toEqual([]);
    expect(latestQuarterSurges([])).toEqual([]);
  });
});

describe('surgeLinkKind and surgeKindLabel', () => {
  it('sends issues to topic pages and the rest to their own', () => {
    expect(surgeLinkKind('issue')).toBe('topic');
    expect(surgeLinkKind('firm')).toBe('firm');
    expect(surgeLinkKind('client')).toBe('client');
    expect(surgeKindLabel('issue')).toBe('Issue area');
    expect(surgeKindLabel('client')).toBe('Client');
  });
});

describe('timesUsualText', () => {
  it('rounds large ratios and keeps one decimal under ten', () => {
    expect(timesUsualText(942000, 17000)).toBe('55 times its usual quarter');
    expect(timesUsualText(315601, 30037.29)).toBe('11 times its usual quarter');
    expect(timesUsualText(450000, 101428.57)).toBe('4.4 times its usual quarter');
  });

  it('says so when the quarter barely moved or had no earlier income', () => {
    expect(timesUsualText(150000, 145866.67)).toBe('about the same as its usual quarter');
    expect(timesUsualText(1000, 0)).toBe('up from nothing in its earlier quarters');
    expect(timesUsualText(0, 0)).toBe('no change on its earlier quarters');
  });
});
