-- @param id STRING
-- Firm page chart: one firm's income across all clients by quarter.
SELECT registrant_id, period_end_date,
       CAST(income AS DOUBLE) AS income,
       client_count
FROM workspace.gold.firm_quarter
WHERE registrant_id = :id
ORDER BY period_end_date
LIMIT 8
