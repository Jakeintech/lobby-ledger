-- @param term STRING
-- Trend page table: the clients whose filings mention one curated term most, by income.
SELECT term, client_id, client, filings_mentioning,
       CAST(income AS DOUBLE) AS income,
       rank
FROM workspace.gold.term_client
WHERE term = lower(:term)
ORDER BY rank
LIMIT 10
