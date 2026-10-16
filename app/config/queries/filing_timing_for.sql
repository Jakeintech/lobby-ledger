-- @param kind STRING
-- @param id STRING
-- Firm or client page section: per quarter, when filings were due and when they were posted, with the late count.
-- A firm files one report per client, so a quarter carries the first and last posted date, the late count,
-- the longest delay and the median delay across its filings.
SELECT period_end_date,
       min(due_date) AS due_date,
       min(due_date_observed) AS due_date_observed,
       min(posted_date) AS first_posted_date,
       max(posted_date) AS last_posted_date,
       CAST(max(days_late) AS INT) AS max_days_late,
       CAST(percentile(days_late, 0.5) AS DOUBLE) AS median_days_late,
       CAST(count(*) AS INT) AS filing_count,
       CAST(sum(CASE WHEN days_late > 0 THEN 1 ELSE 0 END) AS INT) AS late_count,
       max(days_late) > 0 AS late
FROM workspace.gold.filing_timing
WHERE (:kind = 'client' AND client_id = :id)
   OR (:kind = 'firm' AND registrant_id = :id)
GROUP BY period_end_date
ORDER BY period_end_date
LIMIT 16
