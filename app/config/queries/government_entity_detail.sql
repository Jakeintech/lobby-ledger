-- @param id STRING
-- Lobbied entity page header: one government entity with its totals.
SELECT entity_hk, entity_name, engagement_count, client_count, firm_count,
       CAST(income AS DOUBLE) AS income,
       rank, chamber_or_agency
FROM workspace.gold.government_entity
WHERE entity_hk = :id
LIMIT 1
