-- Trends page tiles: the curated keyword terms ranked by income.
SELECT term, filings_mentioning, engagement_count,
       CAST(income AS DOUBLE) AS income,
       first_period, last_period
FROM workspace.gold.term
ORDER BY income DESC
LIMIT 40
