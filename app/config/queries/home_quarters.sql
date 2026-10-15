-- Home chart: income reported across all engagements by quarter.
SELECT period_end_date,
       CAST(sum(income) AS DOUBLE) AS income,
       CAST(count(DISTINCT engagement_hk) AS INT) AS engagement_count
FROM workspace.gold.engagement_quarter
GROUP BY period_end_date
ORDER BY period_end_date
LIMIT 8
