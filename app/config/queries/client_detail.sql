-- @param id STRING
-- Client page header: one client with its firms and totals.
SELECT client_id, name, description, state, firm_count, firms,
       CAST(total_income AS DOUBLE) AS total_income,
       quarters_active, issue_codes, lobbyist_count, engagement_count
FROM workspace.gold.client
WHERE client_id = :id
LIMIT 1
