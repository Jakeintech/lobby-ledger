-- @param id STRING
-- Organization page chart: income reported across one organization's client rows by quarter.
SELECT organization_hk, period_end_date,
       CAST(income AS DOUBLE) AS income,
       engagement_count, client_count, firm_count
FROM workspace.gold.organization_quarter
WHERE organization_hk = :id
ORDER BY period_end_date
LIMIT 8
