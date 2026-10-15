import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/**
 * True while the table inside an element is wider than the element, kept
 * current by a ResizeObserver, so a scrolling table can say that it scrolls.
 * AppKit's Table brings its own scroll wrapper, so the table is measured
 * directly rather than the wrapper's scroll width.
 */
export function useOverflows<T extends HTMLElement>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const table = node.querySelector('table') ?? node;
    const measure = () => setOverflows(table.scrollWidth > node.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observer.observe(table);
    return () => observer.disconnect();
  }, []);
  return [ref, overflows];
}
