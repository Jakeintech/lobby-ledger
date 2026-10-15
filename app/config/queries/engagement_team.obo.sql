-- @param engagement_hk STRING
-- Team and history for one engagement. Runs ON BEHALF OF the signed-in user
-- (the .obo.sql suffix), so Unity Catalog checks that person's grants and
-- current_user() is their email.
SELECT l.full_name AS lobbyist,
       count(DISTINCT b.period_end_date) AS quarters_listed,
       min(b.period_end_date) AS first_period,
       max(b.period_end_date) AS last_period,
       CAST(sum(f.income) AS DOUBLE) AS income_while_listed,
       current_user() AS queried_as
FROM workspace.gold.bridge_registrant_client_lobbyist b
JOIN workspace.gold.dim_lobbyist l ON l.lobbyist_hk = b.lobbyist_hk
JOIN workspace.gold.fact_filing f ON f.filing_uuid = b.filing_uuid
WHERE b.engagement_hk = :engagement_hk
GROUP BY l.full_name
ORDER BY quarters_listed DESC, lobbyist
