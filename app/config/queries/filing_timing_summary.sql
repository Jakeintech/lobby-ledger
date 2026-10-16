-- @param kind STRING
-- @param id STRING
-- Firm or client page figures: share of filings posted after the deadline, median days late and the weekday they post on.
SELECT CAST(count(*) AS INT) AS filing_count,
       CAST(sum(CASE WHEN days_late > 0 THEN 1 ELSE 0 END) AS INT) AS late_count,
       CAST(avg(CASE WHEN days_late > 0 THEN 1.0 ELSE 0.0 END) AS DOUBLE) AS late_share,
       CAST(percentile(days_late, 0.5) AS DOUBLE) AS median_days_late,
       CAST(max(days_late) AS INT) AS max_days_late,
       CAST(sum(CASE WHEN posted_weekday = 'Monday' THEN 1 ELSE 0 END) AS INT) AS monday,
       CAST(sum(CASE WHEN posted_weekday = 'Tuesday' THEN 1 ELSE 0 END) AS INT) AS tuesday,
       CAST(sum(CASE WHEN posted_weekday = 'Wednesday' THEN 1 ELSE 0 END) AS INT) AS wednesday,
       CAST(sum(CASE WHEN posted_weekday = 'Thursday' THEN 1 ELSE 0 END) AS INT) AS thursday,
       CAST(sum(CASE WHEN posted_weekday = 'Friday' THEN 1 ELSE 0 END) AS INT) AS friday,
       CAST(sum(CASE WHEN posted_weekday = 'Saturday' THEN 1 ELSE 0 END) AS INT) AS saturday,
       CAST(sum(CASE WHEN posted_weekday = 'Sunday' THEN 1 ELSE 0 END) AS INT) AS sunday
FROM workspace.gold.filing_timing
WHERE (:kind = 'client' AND client_id = :id)
   OR (:kind = 'firm' AND registrant_id = :id)
LIMIT 1
