-- Revolving door page fallback: every lobbyist with a matched former affiliation, by confidence then client.
SELECT r.lobbyist_id, r.engagement_hk, r.full_name, r.kind, r.ref_name,
       r.client_id, r.client, r.registrant_id, r.firm, r.issue_codes,
       CAST(r.income AS DOUBLE) AS income,
       r.lobbies_former_employer,
       CASE a.confidence_rank WHEN 0 THEN 'high' WHEN 1 THEN 'medium' END AS confidence
FROM workspace.gold.revolving_door r
LEFT JOIN (
  SELECT lobbyist_id, kind, ref_name,
         min(CASE confidence WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END) AS confidence_rank
  FROM workspace.gold.lobbyist_affiliation
  GROUP BY lobbyist_id, kind, ref_name
) a ON a.lobbyist_id = r.lobbyist_id AND a.kind = r.kind AND a.ref_name = r.ref_name
ORDER BY coalesce(a.confidence_rank, 2), r.client, r.income DESC
LIMIT 200
