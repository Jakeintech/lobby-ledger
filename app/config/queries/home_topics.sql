-- Home tiles: issue codes ranked by reported income.
SELECT issue_code, issue_name,
       CAST(total_income AS DOUBLE) AS total_income,
       engagement_count, client_count, firm_count, rank
FROM workspace.gold.topic
ORDER BY rank
LIMIT 30
