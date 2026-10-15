-- @param code STRING
-- Topic page top clients: clients ranked by income under one issue code.
SELECT issue_code, client_id, client,
       CAST(income AS DOUBLE) AS income,
       rank
FROM workspace.gold.topic_client
WHERE issue_code = upper(:code)
ORDER BY rank
LIMIT 10
