-- Home row: clients, firms and issues whose latest-quarter income sits two or more standard deviations above
-- their prior quarters and is at least half again the prior mean, so near-flat quarters with a tiny spread do not count.
SELECT kind, id, name, period_end_date,
       CAST(income AS DOUBLE) AS income,
       CAST(mean_prior AS DOUBLE) AS mean_prior,
       CAST(stddev_prior AS DOUBLE) AS stddev_prior,
       z, is_surge
FROM workspace.gold.surge
WHERE is_surge AND income >= 1.5 * mean_prior
ORDER BY z DESC
LIMIT 40
