-- @param term STRING
-- Trend page header: one curated keyword term with its totals.
SELECT term, filings_mentioning, engagement_count,
       CAST(income AS DOUBLE) AS income,
       first_period, last_period
FROM workspace.gold.term
WHERE term = lower(:term)
LIMIT 1
