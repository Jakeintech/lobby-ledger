-- @param id STRING
-- Lobbyist page engagement table: every engagement that listed the lobbyist.
SELECT lobbyist_id, engagement_hk, client_id, client, registrant_id, firm,
       first_period, last_period, quarters_listed,
       CAST(income_while_listed AS DOUBLE) AS income_while_listed
FROM workspace.gold.lobbyist_engagement
WHERE lobbyist_id = :id
ORDER BY last_period DESC, client
LIMIT 200
