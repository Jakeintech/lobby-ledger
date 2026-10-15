import { useEffect, useRef } from 'react';
import { Slider } from '@databricks/appkit-ui/react';
import { LEDGER_GRID } from '@/lib/ledgerOption';

const THUMB_LABELS = ['First quarter shown', 'Last quarter shown'] as const;

export interface ZoomSliderProps {
  range: [number, number];
  max: number;
  allLabels: string[];
  onChange: (next: number[]) => void;
}

/**
 * The range control, drawn across the plot so it reads as part of the axis.
 * ECharts dataZoom cannot be used here: AppKit's chart bundle registers no
 * DataZoomComponent (nor MarkLine), so a Radix Slider over the same grid
 * margins is the escape hatch. AppKit's Slider names no thumb props, so the
 * thumbs are labelled after render.
 */
export function ZoomSlider({ range, max, allLabels, onChange }: ZoomSliderProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Radix names the thumbs Minimum and Maximum on a render after mount, so
    // the labels are re-applied whenever it writes one; a write only happens
    // on a difference, which stops the observer feeding itself.
    const apply = () => {
      node.querySelectorAll<HTMLElement>('[role="slider"]').forEach((thumb, i) => {
        const label = THUMB_LABELS[i] ?? '';
        const text = allLabels[range[i] ?? 0] ?? '';
        if (thumb.getAttribute('aria-label') !== label) thumb.setAttribute('aria-label', label);
        if (thumb.getAttribute('aria-valuetext') !== text) thumb.setAttribute('aria-valuetext', text);
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label'] });
    return () => observer.disconnect();
  }, [range, allLabels]);
  return (
    <div
      ref={ref}
      role="group"
      aria-label="Quarters shown"
      className="mt-2"
      style={{ paddingLeft: LEDGER_GRID.left, paddingRight: LEDGER_GRID.right }}
    >
      <Slider value={range} min={0} max={max} step={1} onValueChange={onChange} className="w-full" />
    </div>
  );
}
