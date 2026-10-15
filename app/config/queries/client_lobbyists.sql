-- @param id STRING
-- Client page lobbyists: every lobbyist listed on the client's filings, with the firm that listed them.
SELECT l.lobbyist_id, l.full_name, l.covered_positions,
       le.firm, le.registrant_id, le.first_period, le.last_period, le.quarters_listed
FROM workspace.gold.lobbyist_engagement le
JOIN workspace.gold.lobbyist l ON l.lobbyist_id = le.lobbyist_id
WHERE le.client_id = :id
ORDER BY quarters_listed DESC, full_name
LIMIT 200
