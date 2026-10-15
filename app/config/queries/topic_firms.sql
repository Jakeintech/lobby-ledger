-- @param code STRING
-- Topic page top firms: firms ranked by income under one issue code.
SELECT issue_code, registrant_id, firm,
       CAST(income AS DOUBLE) AS income,
       rank
FROM workspace.gold.topic_firm
WHERE issue_code = upper(:code)
ORDER BY rank
LIMIT 10
