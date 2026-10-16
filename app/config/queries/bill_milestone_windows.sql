-- @param congress STRING
-- @param key STRING
-- Bill page: lobbying in the 90 days before each legislative milestone of one bill in one congress.
SELECT milestone, milestone_date,
       CAST(filings_90d_before AS INT) AS filings_90d_before,
       CAST(income_90d_before AS DOUBLE) AS income_90d_before,
       CAST(clients_90d_before AS INT) AS clients_90d_before
FROM workspace.gold.bill_milestone_window
WHERE congress = CAST(:congress AS INT) AND bill_key = upper(:key)
ORDER BY milestone_date
LIMIT 10
