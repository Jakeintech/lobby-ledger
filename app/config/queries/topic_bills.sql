-- @param code STRING
-- Topic page bills: bills cited most often under one issue code.
SELECT issue_code, bill_key, bill_label, engagement_count, filings_mentioning
FROM workspace.gold.topic_bill
WHERE issue_code = upper(:code)
ORDER BY filings_mentioning DESC, bill_label
LIMIT 10
