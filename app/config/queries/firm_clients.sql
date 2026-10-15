-- @param id STRING
-- Firm page client table: every client the firm has represented.
SELECT engagement_hk, client_id, client, client_description, registrant_id, firm,
       issue_codes, bill_labels, government_entities,
       CAST(total_income AS DOUBLE) AS total_income,
       first_period, last_period, quarters_active, engagement_status, ai_summary
FROM workspace.gold.engagement
WHERE registrant_id = :id
ORDER BY total_income DESC
LIMIT 200
