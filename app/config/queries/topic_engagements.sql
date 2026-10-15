-- @param code STRING
-- Topic page engagement table: engagements that listed one issue code.
SELECT engagement_hk, client_id, client, client_description, registrant_id, firm,
       issue_codes, bill_labels, government_entities,
       CAST(total_income AS DOUBLE) AS total_income,
       first_period, last_period, quarters_active, engagement_status, ai_summary
FROM workspace.gold.engagement
WHERE array_contains(split(issue_codes, ', '), upper(:code))
ORDER BY total_income DESC
LIMIT 200
