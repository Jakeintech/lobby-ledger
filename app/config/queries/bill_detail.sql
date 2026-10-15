-- @param congress STRING
-- @param key STRING
-- Bill page header: one bill in one congress with its Congress.gov detail and stage.
SELECT b.congress, b.bill_key, b.bill_label,
       b.engagement_count, b.filings_mentioning,
       CAST(b.income AS DOUBLE) AS income,
       d.title, d.policy_area, d.sponsor_name, d.sponsor_party, d.sponsor_state,
       d.introduced_date, d.latest_action_date, d.latest_action_text,
       d.is_law, d.congress_url, d.stage
FROM workspace.gold.bill_congress b
LEFT JOIN workspace.gold.bill_detail d
  ON d.congress = b.congress AND d.bill_key = b.bill_key
WHERE b.congress = CAST(:congress AS INT) AND b.bill_key = upper(:key)
LIMIT 1
