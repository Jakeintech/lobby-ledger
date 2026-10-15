-- @param key STRING
-- Bill page header: one bill with its citation counts and issue codes.
SELECT bill_key, bill_label, engagement_count, filings_mentioning,
       first_period, last_period, issue_codes
FROM workspace.gold.bill
WHERE bill_key = upper(:key)
LIMIT 1
