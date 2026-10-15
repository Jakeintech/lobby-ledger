import { Sparkline } from '@/components/Sparkline';
import { quarterLabel } from '@/lib/format';
import { spanText } from '@/lib/ledger';
import type { CoveredPosition } from '@/pages/Lobbyist/positions';

/**
 * The covered executive and legislative branch positions the lobbyist
 * disclosed, verbatim from the filings, each with the quarters a report
 * carried it.
 */
export function CoveredPositions({ positions, lobbyistName }: { positions: CoveredPosition[]; lobbyistName: string }) {
  return (
    <figure className="min-w-0">
      <figcaption className="border-t border-border pt-3">
        <p className="font-medium text-foreground">Disclosed former government positions</p>
        <p className="text-sm text-muted-foreground">
          The Lobbying Disclosure Act asks each filing to list the covered executive and legislative branch positions a
          lobbyist held in the previous twenty years. Shown verbatim, with the filer&apos;s own abbreviations and
          punctuation, and the quarters a report carried each one.
        </p>
      </figcaption>
      {positions.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          No former government position was disclosed for {lobbyistName} on any filing in 2024 or 2025.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {positions.map((position) => {
            const span = spanText(position.first, position.last, quarterLabel);
            return (
              <li
                key={position.text}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2 text-sm first:pt-0"
              >
                <span className="min-w-0 flex-1 break-words">{position.text}</span>
                {span && (
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <Sparkline first={position.first} last={position.last} label={`Disclosed ${span}`} />
                    {span}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}
