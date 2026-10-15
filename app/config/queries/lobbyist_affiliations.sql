-- @param id STRING
-- Lobbyist page section: committees, members and agencies matched from one lobbyist's disclosed positions.
SELECT lobbyist_id, kind, ref_id, ref_name, matched_text, confidence
FROM workspace.gold.lobbyist_affiliation
WHERE lobbyist_id = :id
ORDER BY confidence, kind, ref_name
LIMIT 50
