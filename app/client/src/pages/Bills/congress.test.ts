import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONGRESS,
  billsCongressPath,
  congressFromParam,
  filingYearOf,
  ordinal,
  parseCongress,
} from './congress';

describe('ordinal', () => {
  it('suffixes the Congress number', () => {
    expect(ordinal(119)).toBe('119th');
    expect(ordinal(118)).toBe('118th');
    expect(ordinal(101)).toBe('101st');
    expect(ordinal(112)).toBe('112th');
    expect(ordinal(103)).toBe('103rd');
  });
});

describe('parseCongress', () => {
  it('accepts the Congresses in the slice', () => {
    expect(parseCongress('118')).toBe(118);
    expect(parseCongress('119')).toBe(119);
  });
  it('falls back to the default for anything else', () => {
    expect(parseCongress(null)).toBe(DEFAULT_CONGRESS);
    expect(parseCongress('117')).toBe(DEFAULT_CONGRESS);
    expect(parseCongress('abc')).toBe(DEFAULT_CONGRESS);
  });
});

describe('congressFromParam', () => {
  it('accepts the Congresses in the slice', () => {
    expect(congressFromParam('118')).toBe(118);
    expect(congressFromParam('119')).toBe(119);
  });
  it('returns null for a missing, blank or out of slice segment', () => {
    expect(congressFromParam(undefined)).toBeNull();
    expect(congressFromParam('')).toBeNull();
    expect(congressFromParam('117')).toBeNull();
    expect(congressFromParam('HR1')).toBeNull();
  });
});

describe('filingYearOf', () => {
  it('maps a Congress to its filing year', () => {
    expect(filingYearOf(118)).toBe(2024);
    expect(filingYearOf(119)).toBe(2025);
    expect(filingYearOf(117)).toBeNull();
  });
});

describe('billsCongressPath', () => {
  it('leaves the default Congress out of the query string', () => {
    expect(billsCongressPath(119)).toBe('/bills');
    expect(billsCongressPath(118)).toBe('/bills?congress=118');
  });
});
