import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/**
 * The rendered width of an element, in whole pixels, kept current by a
 * ResizeObserver. Zero until the first measurement. Lets HTML laid out
 * beside a canvas, and the canvas itself, share one measured width.
 */
export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => setWidth(Math.round(entries[0]?.contentRect.width ?? 0)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}
