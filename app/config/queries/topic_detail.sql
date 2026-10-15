-- @param code STRING
-- Topic page header: one issue code with its totals and rank.
SELECT issue_code, issue_name,
       CAST(total_income AS DOUBLE) AS total_income,
       engagement_count, client_count, firm_count, rank
FROM workspace.gold.topic
WHERE issue_code = upper(:code)
LIMIT 1
