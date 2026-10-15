-- @param congress STRING
-- @param key STRING
-- Bill page chart: quarterly reports citing one bill in one congress by quarter.
SELECT congress, bill_key, period_end_date, filings_mentioning, engagement_count,
       CAST(income AS DOUBLE) AS income
FROM workspace.gold.bill_quarter
WHERE congress = CAST(:congress AS INT) AND bill_key = upper(:key)
ORDER BY period_end_date
LIMIT 8
