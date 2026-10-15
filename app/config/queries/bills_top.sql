-- @param congress STRING
-- Bills page list: the bills most cited in one congress, ranked by income.
SELECT b.congress, b.bill_key, b.bill_label,
       b.engagement_count, b.filings_mentioning,
       CAST(b.income AS DOUBLE) AS income,
       d.title, d.stage, d.is_law
FROM workspace.gold.bill_congress b
LEFT JOIN workspace.gold.bill_detail d
  ON d.congress = b.congress AND d.bill_key = b.bill_key
WHERE b.congress = CAST(:congress AS INT)
ORDER BY b.income DESC
LIMIT 50
