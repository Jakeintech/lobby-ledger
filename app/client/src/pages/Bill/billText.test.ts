import { describe, expect, it } from 'vitest';
import { longDate, milestoneName } from './billText';

describe('milestoneName', () => {
  it('names every milestone Gold defines in plain words', () => {
    expect(milestoneName('introduced')).toBe('Introduced');
    expect(milestoneName('reported')).toBe('Reported by committee');
    expect(milestoneName('passed_house')).toBe('Passed House');
    expect(milestoneName('passed_senate')).toBe('Passed Senate');
    expect(milestoneName('to_president')).toBe('Sent to the President');
    expect(milestoneName('became_law')).toBe('Became law');
  });

  it('spaces an unknown key instead of hiding it', () => {
    expect(milestoneName(' vetoed_by_president ')).toBe('vetoed by president');
    expect(milestoneName(null)).toBe('');
  });
});

describe('longDate', () => {
  it('writes an ISO date in full', () => {
    expect(longDate('2025-07-04')).toBe('July 4, 2025');
    expect(longDate('2025-07-04T00:00:00Z')).toBe('July 4, 2025');
  });

  it('passes non-dates through and drops blanks', () => {
    expect(longDate('unknown')).toBe('unknown');
    expect(longDate(null)).toBeNull();
    expect(longDate('')).toBeNull();
  });
});
