-- @param id STRING
-- Firm page lobbyists: every lobbyist the firm has listed, with how many clients they covered.
SELECT l.lobbyist_id, l.full_name, l.covered_positions,
       CAST(count(DISTINCT le.client_id) AS INT) AS client_count,
       min(le.first_period) AS first_period,
       max(le.last_period) AS last_period,
       CAST(sum(le.quarters_listed) AS INT) AS quarters_listed
FROM workspace.gold.lobbyist_engagement le
JOIN workspace.gold.lobbyist l ON l.lobbyist_id = le.lobbyist_id
WHERE le.registrant_id = :id
GROUP BY l.lobbyist_id, l.full_name, l.covered_positions
ORDER BY client_count DESC, full_name
LIMIT 200
