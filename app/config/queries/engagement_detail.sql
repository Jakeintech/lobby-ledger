-- @param hk STRING
-- Engagement row detail: one registrant-client engagement with its summary.
SELECT engagement_hk, client_id, client, client_description, registrant_id, firm,
       issue_codes, bill_labels, government_entities,
       CAST(total_income AS DOUBLE) AS total_income,
       first_period, last_period, quarters_active, engagement_status, ai_summary
FROM workspace.gold.engagement
WHERE engagement_hk = :hk
LIMIT 1
