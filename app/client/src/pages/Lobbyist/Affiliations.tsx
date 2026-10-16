import { Link } from 'react-router';
import { EntityLink, LINK_CLASS } from '@/components/EntityLink';
import { lobbiedEntityPath } from '@/lib/routes';
import { ConfidenceMark } from '@/pages/Lobbyist/ConfidenceMark';
import { isEntityHash, kindLabel, toConfidence } from '@/pages/Lobbyist/affiliation';
import { splitCodes } from '@/pages/RevolvingDoor/rows';

/** One row of `lobbyist_affiliations`. */
export interface AffiliationRow {
  kind: string;
  /** A committee thomas_id, a member bioguide_id, or a government entity hash. */
  ref_id: string;
  ref_name: string;
  matched_text: string | null;
  confidence: string | null;
  /** Comma separated issue codes the committee has jurisdiction over; null for members and agencies. */
  jurisdiction_issues?: string | null;
}

export interface AffiliationsProps {
  rows: AffiliationRow[];
  lobbyistName: string;
  /** False when no covered position was disclosed at all, so the empty line can say so. */
  hasPositions: boolean;
}

/**
 * The committees, members of Congress and agencies whose names appear in the
 * lobbyist's disclosed positions. Only agencies have a page in the app, so
 * only they link; committee and member names are shown as matched, and a
 * committee lists the issue areas under its jurisdiction as topic links.
 */
export function Affiliations({ rows, lobbyistName, hasPositions }: AffiliationsProps) {
  return (
    <figure className="min-w-0">
      <figcaption className="border-t border-border pt-3">
        <p className="font-medium text-foreground">Committees, members and agencies named in those positions</p>
        <p className="text-sm text-muted-foreground">
          Each match is textual: a disclosed position names a standing committee, a member of Congress by title and
          surname, or a government entity that filings list as contacted. It rests on what {lobbyistName} disclosed and
          says nothing about the role held. Agencies link to the filings that contacted them; a committee lists the
          issue areas it has jurisdiction over.
        </p>
      </figcaption>
      {rows.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          {hasPositions
            ? `No committee, member or agency name could be matched in the positions ${lobbyistName} disclosed.`
            : `No former position was disclosed for ${lobbyistName}, so there is nothing to match.`}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((row) => {
            const linked = row.kind.trim().toLowerCase() === 'agency' && isEntityHash(row.ref_id);
            const matched = row.matched_text?.trim();
            const issues = splitCodes(row.jurisdiction_issues);
            return (
              <li
                key={`${row.kind}:${row.ref_id}`}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2 text-sm first:pt-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-muted-foreground">{kindLabel(row.kind)}: </span>
                  {linked ? (
                    <Link to={lobbiedEntityPath(row.ref_id)} className={LINK_CLASS}>
                      {row.ref_name}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">{row.ref_name}</span>
                  )}
                  {matched && (
                    <span className="block text-xs text-muted-foreground">Matched on &ldquo;{matched}&rdquo;</span>
                  )}
                  {issues.length > 0 && (
                    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                      <span className="text-muted-foreground">Jurisdiction over</span>
                      {issues.map((code) => (
                        <EntityLink key={code} kind="topic" id={code} />
                      ))}
                    </span>
                  )}
                </span>
                <ConfidenceMark confidence={toConfidence(row.confidence)} className="shrink-0" />
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}
