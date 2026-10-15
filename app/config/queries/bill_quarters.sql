-- @param key STRING
-- Bill page chart: quarterly reports citing one bill by quarter.
SELECT bill_key, period_end_date, filings_mentioning, engagement_count
FROM workspace.gold.bill_quarter
WHERE bill_key = upper(:key)
ORDER BY period_end_date
LIMIT 8
