import { describe, expect, it } from 'vitest';
import { squarify } from './squarify';

describe('squarify', () => {
  const items = [
    { id: 'a', value: 6 },
    { id: 'b', value: 6 },
    { id: 'c', value: 4 },
    { id: 'd', value: 3 },
    { id: 'e', value: 2 },
    { id: 'f', value: 2 },
    { id: 'g', value: 1 },
  ];

  it('fills the rectangle exactly, in proportion to value', () => {
    const tiles = squarify(items, 600, 400);
    expect(tiles).toHaveLength(items.length);
    const area = tiles.reduce((s, t) => s + t.w * t.h, 0);
    expect(area).toBeCloseTo(600 * 400, 3);
    const a = tiles.find((t) => t.id === 'a')!;
    expect(a.w * a.h).toBeCloseTo((6 / 24) * 600 * 400, 3);
  });

  it('keeps every tile inside the bounds', () => {
    for (const t of squarify(items, 300, 500)) {
      expect(t.x).toBeGreaterThanOrEqual(-1e-6);
      expect(t.y).toBeGreaterThanOrEqual(-1e-6);
      expect(t.x + t.w).toBeLessThanOrEqual(300 + 1e-6);
      expect(t.y + t.h).toBeLessThanOrEqual(500 + 1e-6);
    }
  });

  it('keeps tiles reasonably square', () => {
    for (const t of squarify(items, 600, 400)) {
      expect(Math.max(t.w / t.h, t.h / t.w)).toBeLessThan(4);
    }
  });

  it('drops zero, negative and junk values and handles empty input', () => {
    expect(
      squarify(
        [
          { id: 'x', value: 0 },
          { id: 'y', value: -2 },
          { id: 'z', value: Number.NaN },
        ],
        100,
        100
      )
    ).toEqual([]);
    expect(squarify([], 100, 100)).toEqual([]);
    expect(squarify(items, 0, 100)).toEqual([]);
  });
});
