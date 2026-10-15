-- Foreign page list: countries ranked by income on foreign-linked filings.
SELECT country, engagement_count, client_count, foreign_entity_count,
       CAST(income AS DOUBLE) AS income,
       rank
FROM workspace.gold.foreign_country
ORDER BY rank
LIMIT 60
