-- @param id STRING
-- Client page chart: income reported on one client's filings by quarter.
SELECT client_id, period_end_date,
       CAST(income AS DOUBLE) AS income,
       engagement_count
FROM workspace.gold.client_quarter
WHERE client_id = :id
ORDER BY period_end_date
LIMIT 8
