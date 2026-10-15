-- @param engagement_hk STRING
-- @param as_of_date DATE
-- What did this engagement look like at the end of a given quarter?
-- pit_engagement points at the filing that was current on that date.
SELECT p.snapshot_date, p.as_of_period_end, f.filing_type,
       CAST(f.income AS DOUBLE) AS income_that_quarter,
       CASE WHEN f.is_termination THEN 'terminated'
            WHEN p.as_of_period_end < p.snapshot_date THEN 'lapsed'
            ELSE 'active' END AS status_as_of,
       (SELECT concat_ws(', ', collect_list(l.full_name))
          FROM workspace.gold.bridge_registrant_client_lobbyist b
          JOIN workspace.gold.dim_lobbyist l ON l.lobbyist_hk = b.lobbyist_hk
         WHERE b.filing_uuid = p.filing_uuid) AS team_as_of
FROM workspace.gold.pit_engagement p
JOIN workspace.gold.fact_filing f ON f.filing_uuid = p.filing_uuid
WHERE p.engagement_hk = :engagement_hk
  AND p.snapshot_date = last_day(CAST(:as_of_date AS DATE))
