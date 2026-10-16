-- @param congress STRING
-- @param key STRING
-- Bill page graph: the engagement-bill edges for one bill (top 150 by filings) plus the client-firm edges of those engagements.
WITH bill_edges AS (
  SELECT src_kind, src_id, dst_kind, dst_id, weight
  FROM workspace.gold.edge
  WHERE src_kind = 'engagement' AND dst_kind = 'bill'
    AND dst_id = concat(CAST(CAST(:congress AS INT) AS STRING), '-', upper(:key))
  ORDER BY weight DESC, src_id
  LIMIT 150
),
pair_edges AS (
  SELECT DISTINCT x.src_kind, x.src_id, x.dst_kind, x.dst_id, x.weight
  FROM bill_edges b
  JOIN workspace.gold.engagement e ON e.engagement_hk = b.src_id
  JOIN workspace.gold.edge x
    ON x.src_kind = 'client' AND x.src_id = e.client_id
   AND x.dst_kind = 'firm' AND x.dst_id = e.registrant_id
)
SELECT src_kind, src_id, dst_kind, dst_id,
       CAST(weight AS DOUBLE) AS weight
FROM (
  SELECT * FROM bill_edges
  UNION ALL
  SELECT * FROM pair_edges
)
ORDER BY dst_kind, weight DESC, src_id
LIMIT 300
