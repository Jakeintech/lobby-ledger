-- @param q STRING
-- Trends page live search: filings mentioning any phrase and their income by quarter.
SELECT period_end_date,
       CAST(count(*) AS INT) AS filings_mentioning,
       CAST(count(DISTINCT engagement_hk) AS INT) AS engagement_count,
       CAST(sum(income) AS DOUBLE) AS income
FROM (
  SELECT filing_uuid, period_end_date, max(engagement_hk) AS engagement_hk, max(income) AS income
  FROM workspace.gold.activity_text
  WHERE text_lower LIKE concat('%', lower(:q), '%') AND period_end_date IS NOT NULL
  GROUP BY filing_uuid, period_end_date
)
GROUP BY period_end_date
ORDER BY period_end_date
LIMIT 8
