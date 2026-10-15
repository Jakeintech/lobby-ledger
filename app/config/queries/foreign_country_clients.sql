-- @param country STRING
-- Foreign country page table: the clients linked to one country, by income.
SELECT country, client_id, client, registrant_id, firm,
       CAST(income AS DOUBLE) AS income,
       foreign_entity_names, issue_codes, rank
FROM workspace.gold.foreign_country_client
WHERE country = :country
ORDER BY rank
LIMIT 100
