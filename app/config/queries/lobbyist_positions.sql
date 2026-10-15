-- @param id STRING
-- Lobbyist page section: covered government positions as disclosed by one lobbyist.
SELECT lobbyist_id, position_text, first_period, last_period
FROM workspace.gold.lobbyist_position
WHERE lobbyist_id = :id
ORDER BY last_period DESC, position_text
LIMIT 50
