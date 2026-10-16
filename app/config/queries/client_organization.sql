-- @param id STRING
-- Client page section: the organization one client belongs to and its sibling client rows with their firms.
SELECT o.organization_hk, o.organization_name, o.client_count, o.firm_count,
       CAST(o.total_income AS DOUBLE) AS organization_income,
       f.client_id, f.client, f.registrant_id, f.firm, f.engagement_count,
       CAST(f.total_income AS DOUBLE) AS total_income,
       f.first_period, f.last_period, f.rank,
       f.client_id = :id AS is_self
FROM workspace.gold.client c
JOIN workspace.gold.organization o ON o.organization_hk = c.organization_hk
JOIN workspace.gold.organization_firm f ON f.organization_hk = o.organization_hk
WHERE c.client_id = :id
ORDER BY is_self DESC, f.rank
LIMIT 50
