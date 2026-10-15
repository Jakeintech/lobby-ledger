-- @param congress STRING
-- @param key STRING
-- Bill page engagement table: engagements whose filings cited one bill in one congress.
SELECT e.engagement_hk, e.client_id, e.client, e.client_description, e.registrant_id, e.firm,
       e.issue_codes, e.bill_labels, e.government_entities,
       CAST(e.total_income AS DOUBLE) AS total_income,
       e.first_period, e.last_period, e.quarters_active, e.engagement_status, e.ai_summary,
       b.filings_mentioning,
       b.first_period AS bill_first_period,
       b.last_period AS bill_last_period
FROM workspace.gold.bill_engagement b
JOIN workspace.gold.engagement e ON e.engagement_hk = b.engagement_hk
WHERE b.congress = CAST(:congress AS INT) AND b.bill_key = upper(:key)
ORDER BY total_income DESC
LIMIT 200
