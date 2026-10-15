-- @param term STRING
-- Trend page issue mix: the issue codes on filings that mention one curated term.
SELECT term, issue_code, filings_mentioning
FROM workspace.gold.term_issue
WHERE term = lower(:term)
ORDER BY filings_mentioning DESC
LIMIT 20
