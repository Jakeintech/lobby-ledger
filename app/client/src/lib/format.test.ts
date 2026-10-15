import { describe, expect, it } from 'vitest';
import { billLabel, money, normalizeBillKey, quarterLabel } from './format';

describe('normalizeBillKey', () => {
  it('strips punctuation and spacing from House bill numbers', () => {
    expect(normalizeBillKey('H.R. 1')).toBe('HR1');
    expect(normalizeBillKey('h.r.1')).toBe('HR1');
    expect(normalizeBillKey('HR 1')).toBe('HR1');
    expect(normalizeBillKey('HR1')).toBe('HR1');
    expect(normalizeBillKey('  hr  1  ')).toBe('HR1');
  });

  it('handles Senate bills and joint resolutions', () => {
    expect(normalizeBillKey('S. 1477')).toBe('S1477');
    expect(normalizeBillKey('s1477')).toBe('S1477');
    expect(normalizeBillKey('HJRES 12')).toBe('HJRES12');
    expect(normalizeBillKey('H.J.Res. 12')).toBe('HJRES12');
    expect(normalizeBillKey('S.J.Res. 5')).toBe('SJRES5');
    expect(normalizeBillKey('H.Con.Res. 3')).toBe('HCONRES3');
    expect(normalizeBillKey('S.Con.Res. 3')).toBe('SCONRES3');
    expect(normalizeBillKey('H.Res. 7')).toBe('HRES7');
    expect(normalizeBillKey('S.Res. 7')).toBe('SRES7');
  });

  it('drops leading zeros from the number', () => {
    expect(normalizeBillKey('H.R. 0001')).toBe('HR1');
  });

  it('returns null for anything that is not a bill number', () => {
    expect(normalizeBillKey('')).toBeNull();
    expect(normalizeBillKey('   ')).toBeNull();
    expect(normalizeBillKey('Google')).toBeNull();
    expect(normalizeBillKey('HR')).toBeNull();
    expect(normalizeBillKey('1477')).toBeNull();
    expect(normalizeBillKey('H.R. 0')).toBeNull();
    expect(normalizeBillKey('HR 123456')).toBeNull();
    expect(normalizeBillKey('AKIN GUMP STRAUSS HAUER & FELD')).toBeNull();
  });
});

describe('billLabel', () => {
  it('formats every chamber and resolution type', () => {
    expect(billLabel('HR1')).toBe('H.R. 1');
    expect(billLabel('S1477')).toBe('S. 1477');
    expect(billLabel('HJRES12')).toBe('H.J.Res. 12');
    expect(billLabel('SJRES5')).toBe('S.J.Res. 5');
    expect(billLabel('HCONRES3')).toBe('H.Con.Res. 3');
    expect(billLabel('SCONRES3')).toBe('S.Con.Res. 3');
    expect(billLabel('HRES7')).toBe('H.Res. 7');
    expect(billLabel('SRES7')).toBe('S.Res. 7');
  });

  it('returns unknown keys unchanged', () => {
    expect(billLabel('NOTABILL')).toBe('NOTABILL');
    expect(billLabel('')).toBe('');
  });

  it('round trips through normalizeBillKey', () => {
    for (const key of ['HR1', 'S1477', 'HJRES12', 'SJRES5', 'HCONRES3', 'SCONRES3', 'HRES7', 'SRES7']) {
      expect(normalizeBillKey(billLabel(key))).toBe(key);
    }
  });
});

describe('quarterLabel', () => {
  it('maps a quarter end date to its quarter', () => {
    expect(quarterLabel('2024-03-31')).toBe('Q1 2024');
    expect(quarterLabel('2024-06-30')).toBe('Q2 2024');
    expect(quarterLabel('2024-09-30')).toBe('Q3 2024');
    expect(quarterLabel('2024-12-31')).toBe('Q4 2024');
    expect(quarterLabel('2025-12-31')).toBe('Q4 2025');
  });

  it('accepts timestamps and Date objects', () => {
    expect(quarterLabel('2025-06-30T00:00:00.000Z')).toBe('Q2 2025');
    expect(quarterLabel(new Date(Date.UTC(2025, 8, 30)))).toBe('Q3 2025');
  });

  it('returns the input when it is not a date', () => {
    expect(quarterLabel('')).toBe('');
    expect(quarterLabel('not a date')).toBe('not a date');
  });
});

describe('money', () => {
  it('formats whole dollars with separators', () => {
    expect(money(0)).toBe('$0');
    expect(money(1234567)).toBe('$1,234,567');
    expect(money(1234567.89)).toBe('$1,234,568');
  });

  it('accepts decimal strings as the warehouse returns them', () => {
    expect(money('500000.00')).toBe('$500,000');
  });

  it('treats null, undefined and junk as zero', () => {
    expect(money(null)).toBe('$0');
    expect(money(undefined)).toBe('$0');
    expect(money('abc')).toBe('$0');
  });

  it('compacts large values when asked', () => {
    expect(money(950, { compact: true })).toBe('$950');
    expect(money(12500, { compact: true })).toBe('$12.5K');
    expect(money(1200000, { compact: true })).toBe('$1.2M');
    expect(money(2000000000, { compact: true })).toBe('$2B');
  });
});
