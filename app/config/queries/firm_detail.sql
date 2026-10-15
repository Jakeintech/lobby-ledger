-- @param id STRING
-- Firm page header: one registrant with its client count and totals.
SELECT registrant_id, name, description, city, state, client_count,
       CAST(total_income AS DOUBLE) AS total_income,
       issue_codes, lobbyist_count, engagement_count
FROM workspace.gold.firm
WHERE registrant_id = :id
LIMIT 1
