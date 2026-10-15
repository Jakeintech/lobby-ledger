-- @param key STRING
-- Bill page engagement table: engagements whose filings cited one bill.
SELECT e.engagement_hk, e.client_id, e.client, e.client_description, e.registrant_id, e.firm,
       e.issue_codes, e.bill_labels, e.government_entities,
       CAST(e.total_income AS DOUBLE) AS total_income,
       e.first_period, e.last_period, e.quarters_active, e.engagement_status, e.ai_summary,
       CAST(b.filings_mentioning AS INT) AS filings_mentioning,
       b.first_period AS bill_first_period,
       b.last_period AS bill_last_period
FROM workspace.gold.engagement e
JOIN workspace.gold.engagement_bill b ON b.engagement_hk = e.engagement_hk
WHERE b.bill_key = upper(:key)
ORDER BY total_income DESC
LIMIT 200
