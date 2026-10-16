-- @param country STRING
-- Foreign country page header: one country with its totals.
SELECT country, country_name, engagement_count, client_count, foreign_entity_count,
       CAST(income AS DOUBLE) AS income,
       rank
FROM workspace.gold.foreign_country
WHERE country = :country
LIMIT 1
