-- @param id STRING
-- Lobbied entity page table: the clients whose filings contacted one entity, by income.
SELECT entity_hk, client_id, client,
       CAST(income AS DOUBLE) AS income,
       rank
FROM workspace.gold.government_entity_client
WHERE entity_hk = :id
ORDER BY rank
LIMIT 50
