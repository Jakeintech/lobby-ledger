/**
 * Squarified treemap layout (Bruls, Huizing and van Wijk). Items are laid
 * in rows along the shorter side of the free rectangle while adding the next
 * item keeps the tiles nearly square.
 */

export interface SquarifyItem {
  id: string;
  value: number;
}

export interface SquarifyTile extends SquarifyItem {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The worst aspect ratio among tiles of the given areas laid along a side. */
function worst(areas: number[], side: number): number {
  const sum = areas.reduce((s, v) => s + v, 0);
  if (sum <= 0 || side <= 0) return Number.POSITIVE_INFINITY;
  const max = Math.max(...areas);
  const min = Math.min(...areas);
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
}

export function squarify<T extends SquarifyItem>(items: T[], width: number, height: number): Array<T & SquarifyTile> {
  const positive = items
    .filter((item) => Number.isFinite(item.value) && item.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = positive.reduce((s, r) => s + r.value, 0);
  if (!positive.length || total <= 0 || width <= 0 || height <= 0) return [];
  const scale = (width * height) / total;

  const tiles: Array<T & SquarifyTile> = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let row: T[] = [];

  const layoutRow = () => {
    const sum = row.reduce((s, r) => s + r.value * scale, 0);
    const vertical = w >= h;
    const side = vertical ? h : w;
    const thickness = sum / side;
    let offset = 0;
    for (const item of row) {
      const length = (item.value * scale) / thickness;
      tiles.push(
        vertical
          ? { ...item, x, y: y + offset, w: thickness, h: length }
          : { ...item, x: x + offset, y, w: length, h: thickness }
      );
      offset += length;
    }
    if (vertical) {
      x += thickness;
      w -= thickness;
    } else {
      y += thickness;
      h -= thickness;
    }
    row = [];
  };

  for (const item of positive) {
    const side = Math.min(w, h);
    const areas = row.map((r) => r.value * scale);
    if (row.length === 0 || worst([...areas, item.value * scale], side) <= worst(areas, side)) {
      row.push(item);
    } else {
      layoutRow();
      row.push(item);
    }
  }
  if (row.length) layoutRow();
  return tiles;
}
