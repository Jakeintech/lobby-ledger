-- Lobbied page list: government entities ranked by income on filings that contacted them.
SELECT entity_hk, entity_name, engagement_count, client_count, firm_count,
       CAST(income AS DOUBLE) AS income,
       rank, chamber_or_agency
FROM workspace.gold.government_entity
ORDER BY income DESC
LIMIT 100
