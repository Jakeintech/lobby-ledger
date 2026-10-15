-- @param term STRING
-- Trend page chart: filings mentioning one curated term and their income by quarter.
SELECT term, period_end_date, filings_mentioning, engagement_count,
       CAST(income AS DOUBLE) AS income
FROM workspace.gold.term_quarter
WHERE term = lower(:term)
ORDER BY period_end_date
LIMIT 8
