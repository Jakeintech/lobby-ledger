-- @param kind STRING
-- @param id STRING
-- Entity page line: where one client or firm's income on each issue code ranks among its peers on that code.
SELECT kind, id, issue_code,
       CAST(income AS DOUBLE) AS income,
       pct_rank
FROM workspace.gold.peer_rank
WHERE kind = :kind AND id = :id
ORDER BY pct_rank DESC, income DESC
LIMIT 100
