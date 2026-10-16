-- @param id STRING
-- Organization page table: every firm the organization has registered with, by income.
SELECT organization_hk, registrant_id, firm, client_id, client, engagement_count,
       CAST(total_income AS DOUBLE) AS total_income,
       first_period, last_period, rank
FROM workspace.gold.organization_firm
WHERE organization_hk = :id
ORDER BY rank
LIMIT 100
