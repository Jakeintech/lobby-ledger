-- @param congress STRING
-- Bills page list: lobbied bills in one congress that became law, ranked by income.
SELECT b.congress, b.bill_key, b.bill_label,
       b.engagement_count, b.filings_mentioning,
       CAST(b.income AS DOUBLE) AS income,
       d.title, d.stage, d.is_law
FROM workspace.gold.bill_congress b
JOIN workspace.gold.bill_detail d
  ON d.congress = b.congress AND d.bill_key = b.bill_key
WHERE b.congress = CAST(:congress AS INT) AND d.is_law
ORDER BY b.income DESC
LIMIT 50
