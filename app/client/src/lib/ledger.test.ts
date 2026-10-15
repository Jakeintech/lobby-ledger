import { describe, expect, it } from 'vitest';
import {
  QUARTER_ENDS,
  escapeHtml,
  niceScale,
  quarterEndOf,
  quarterFraction,
  quarterIndex,
  quarterOrdinal,
  spanIncludes,
  spanText,
} from './ledger';

describe('quarterIndex', () => {
  it('maps every quarter end to its slot', () => {
    QUARTER_ENDS.forEach((end, i) => expect(quarterIndex(end)).toBe(i));
  });

  it('maps any date in a quarter to that slot', () => {
    expect(quarterIndex('2024-01-01')).toBe(0);
    expect(quarterIndex('2025-07-04')).toBe(6);
    expect(quarterIndex('2025-12-31T00:00:00.000Z')).toBe(7);
  });

  it('returns null outside 2024 to 2025 or for junk', () => {
    expect(quarterIndex('2023-12-31')).toBeNull();
    expect(quarterIndex('2026-01-01')).toBeNull();
    expect(quarterIndex(null)).toBeNull();
    expect(quarterIndex('soon')).toBeNull();
  });
});

describe('quarterOrdinal and quarterEndOf', () => {
  it('counts quarters continuously across years', () => {
    expect(quarterOrdinal('2024-12-31')! + 1).toBe(quarterOrdinal('2025-01-15'));
  });

  it('finds the quarter end of any date', () => {
    expect(quarterEndOf('2024-02-29')).toBe('2024-03-31');
    expect(quarterEndOf('2025-07-04')).toBe('2025-09-30');
    expect(quarterEndOf('2025-11-01')).toBe('2025-12-31');
    expect(quarterEndOf('nope')).toBeNull();
  });
});

describe('quarterFraction', () => {
  it('runs from 0 on the first day to 1 on the last', () => {
    expect(quarterFraction('2024-01-01')).toBe(0);
    expect(quarterFraction('2024-03-31')).toBe(1);
    expect(quarterFraction('2025-08-15')).toBeCloseTo(0.5, 1);
  });
});

describe('spanIncludes', () => {
  it('is inclusive at both ends and ignores the day', () => {
    expect(spanIncludes('2024-03-31', '2024-09-30', '2024-03-31')).toBe(true);
    expect(spanIncludes('2024-03-31', '2024-09-30', '2024-08-01')).toBe(true);
    expect(spanIncludes('2024-03-31', '2024-09-30', '2024-12-31')).toBe(false);
    expect(spanIncludes(null, '2024-09-30', '2024-06-30')).toBe(false);
  });
});

describe('niceScale', () => {
  it('clears the maximum with round intervals', () => {
    const scale = niceScale(1_234_567);
    expect(scale.max).toBeGreaterThanOrEqual(1_234_567);
    expect(scale.max / scale.interval).toBe(4);
    expect([1, 2, 2.5, 5].some((m) => scale.interval === m * 10 ** Math.floor(Math.log10(scale.interval)))).toBe(true);
  });

  it('handles zero and junk', () => {
    expect(niceScale(0)).toEqual({ max: 4, interval: 1 });
    expect(niceScale(Number.NaN)).toEqual({ max: 4, interval: 1 });
  });
});

describe('escapeHtml and spanText', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml('AT&T <b>"x"</b>')).toBe('AT&amp;T &lt;b&gt;&quot;x&quot;&lt;/b&gt;');
  });

  it('collapses a one quarter span', () => {
    const label = (iso: string) => iso.slice(0, 7);
    expect(spanText('2024-03-31', '2024-03-31', label)).toBe('2024-03');
    expect(spanText('2024-03-31', '2024-06-30', label)).toBe('2024-03 to 2024-06');
    expect(spanText(null, '2024-06-30', label)).toBeNull();
  });
});
