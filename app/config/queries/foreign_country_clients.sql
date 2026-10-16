-- @param country STRING
-- Foreign country page table: the clients linked to one country, by income.
SELECT c.country, f.country_name, c.client_id, c.client, c.registrant_id, c.firm,
       CAST(c.income AS DOUBLE) AS income,
       c.foreign_entity_names, c.issue_codes, c.rank
FROM workspace.gold.foreign_country_client c
LEFT JOIN workspace.gold.foreign_country f ON f.country = c.country
WHERE c.country = :country
ORDER BY c.rank
LIMIT 100
