-- @param id STRING
-- Lobbied entity page issue mix: the issue codes on filings that contacted one entity.
SELECT entity_hk, issue_code, engagement_count,
       CAST(income AS DOUBLE) AS income,
       rank
FROM workspace.gold.government_entity_issue
WHERE entity_hk = :id
ORDER BY rank
LIMIT 20
