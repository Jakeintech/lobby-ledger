-- Revolving door page list: lobbyists whose engagements contacted their disclosed former employer, by income.
SELECT lobbyist_id, engagement_hk, full_name, kind, ref_name,
       client_id, client, registrant_id, firm, issue_codes,
       CAST(income AS DOUBLE) AS income,
       lobbies_former_employer, jurisdiction_match
FROM workspace.gold.revolving_door
WHERE lobbies_former_employer
ORDER BY income DESC
LIMIT 200
