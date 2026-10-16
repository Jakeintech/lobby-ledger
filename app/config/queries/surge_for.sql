-- @param kind STRING
-- @param id STRING
-- Entity page badge: one client, firm or issue's quarterly income against its prior quarters, with the surge z-score.
SELECT kind, id, name, period_end_date,
       CAST(income AS DOUBLE) AS income,
       CAST(mean_prior AS DOUBLE) AS mean_prior,
       CAST(stddev_prior AS DOUBLE) AS stddev_prior,
       z, is_surge
FROM workspace.gold.surge
WHERE kind = :kind AND id = :id
ORDER BY period_end_date
LIMIT 8
