-- @param issue_code STRING
-- @param keyword STRING
-- @param year INT
-- Search engagements. Reads Gold only. Runs as the app service principal.
-- Optional filters: pass '' for issue_code / keyword and 0 for year to skip them.
SELECT engagement_hk, firm, client, client_description, issue_codes, lobbyist_count,
       CAST(total_income AS DOUBLE) AS total_income, first_period, last_period,
       quarters_active, engagement_status, ai_summary
FROM workspace.gold.experience_search
WHERE (:issue_code = '' OR array_contains(split(issue_codes, ', '), :issue_code))
  AND (:keyword = '' OR lower(concat_ws(' ', client, client_description, issues_text, ai_summary))
                        LIKE concat('%', lower(:keyword), '%'))
  AND (:year = 0 OR (year(first_period) <= :year AND year(last_period) >= :year))
ORDER BY last_period DESC, total_income DESC
LIMIT 200
