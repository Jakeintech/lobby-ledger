-- @param id STRING
-- Lobbyist page header: one lobbyist with covered positions and activity span.
SELECT lobbyist_id, full_name, covered_positions, client_count, firm_count,
       quarters_active, first_period, last_period
FROM workspace.gold.lobbyist
WHERE lobbyist_id = :id
LIMIT 1
