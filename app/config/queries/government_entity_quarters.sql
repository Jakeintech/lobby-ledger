-- @param id STRING
-- Lobbied entity page chart: income on filings that contacted one entity by quarter.
SELECT entity_hk, period_end_date, engagement_count,
       CAST(income AS DOUBLE) AS income
FROM workspace.gold.government_entity_quarter
WHERE entity_hk = :id
ORDER BY period_end_date
LIMIT 8
