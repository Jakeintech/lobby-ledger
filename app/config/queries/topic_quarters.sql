-- @param code STRING
-- Topic page chart: income under one issue code by quarter.
SELECT issue_code, period_end_date,
       CAST(income AS DOUBLE) AS income,
       engagement_count, client_count, firm_count
FROM workspace.gold.topic_quarter
WHERE issue_code = upper(:code)
ORDER BY period_end_date
LIMIT 8
