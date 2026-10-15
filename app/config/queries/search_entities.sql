-- @param q STRING
-- Home search: clients and firms whose name contains the typed text.
SELECT kind, id, name,
       CAST(total_income AS DOUBLE) AS total_income
FROM workspace.gold.search_entity
WHERE lower(name) LIKE concat('%', lower(:q), '%')
ORDER BY total_income DESC
LIMIT 25
