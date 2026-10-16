-- @param id STRING
-- Organization page table: the client rows that map to one organization, by income.
SELECT client_id, name, description, state, firm_count, firms,
       CAST(total_income AS DOUBLE) AS total_income,
       quarters_active, issue_codes, lobbyist_count, engagement_count,
       organization_hk, organization_name
FROM workspace.gold.client
WHERE organization_hk = :id
ORDER BY total_income DESC
LIMIT 100
