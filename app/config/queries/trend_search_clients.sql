-- @param q STRING
-- Trends page live search: the clients whose filings mention any phrase most, by income.
SELECT e.client_id, e.client,
       CAST(count(DISTINCT f.filing_uuid) AS INT) AS filings_mentioning,
       CAST(count(DISTINCT f.engagement_hk) AS INT) AS engagement_count,
       CAST(sum(f.income) AS DOUBLE) AS income
FROM (
  SELECT filing_uuid, max(engagement_hk) AS engagement_hk, max(income) AS income
  FROM workspace.gold.activity_text
  WHERE text_lower LIKE concat('%', lower(:q), '%')
  GROUP BY filing_uuid
) f
JOIN workspace.gold.engagement e ON e.engagement_hk = f.engagement_hk
GROUP BY e.client_id, e.client
ORDER BY income DESC
LIMIT 10
