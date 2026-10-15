import { describe, expect, it } from 'vitest';
import { confidenceLabel, isEntityHash, kindLabel, toConfidence } from './affiliation';

describe('kindLabel', () => {
  it('spells out each kind in sentence case', () => {
    expect(kindLabel('committee')).toBe('Committee');
    expect(kindLabel('member')).toBe('Member of Congress');
    expect(kindLabel('agency')).toBe('Agency');
  });

  it('joins kinds the revolving door list has combined', () => {
    expect(kindLabel('committee, member')).toBe('Committee and member of Congress');
    expect(kindLabel('agency, committee, member')).toBe('Agency, committee and member of Congress');
  });

  it('passes unknown kinds through and falls back when empty', () => {
    expect(kindLabel('Caucus')).toBe('Caucus');
    expect(kindLabel('')).toBe('Affiliation');
    expect(kindLabel(null)).toBe('Affiliation');
  });
});

describe('toConfidence', () => {
  it('accepts the two levels in any case and rejects the rest', () => {
    expect(toConfidence('high')).toBe('high');
    expect(toConfidence(' Medium ')).toBe('medium');
    expect(toConfidence('low')).toBeNull();
    expect(toConfidence(null)).toBeNull();
    expect(toConfidence(undefined)).toBeNull();
  });
});

describe('confidenceLabel', () => {
  it('describes each level and the missing case', () => {
    expect(confidenceLabel('high')).toBe('exact name match');
    expect(confidenceLabel('medium')).toBe('partial name match');
    expect(confidenceLabel(null)).toBe('match confidence not recorded');
  });
});

describe('isEntityHash', () => {
  it('recognises a 32 character hex md5 and nothing else', () => {
    expect(isEntityHash('652d9fd965098b358d1da2d96cfd9073')).toBe(true);
    expect(isEntityHash('652D9FD965098B358D1DA2D96CFD9073')).toBe(true);
    expect(isEntityHash('D000617')).toBe(false);
    expect(isEntityHash('HSWM')).toBe(false);
    expect(isEntityHash('')).toBe(false);
    expect(isEntityHash(null)).toBe(false);
  });
});
