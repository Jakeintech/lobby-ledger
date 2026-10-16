-- @param q STRING
-- Home search: firms and clients whose name contains the typed text, one row per organization for clients,
-- carrying the organization's total income and its client row and firm counts when it has several rows.
SELECT kind, id, name,
       CAST(coalesce(organization_income, total_income) AS DOUBLE) AS total_income,
       CAST(coalesce(client_count, 1) AS INT) AS client_count,
       CAST(coalesce(firm_count, 1) AS INT) AS firm_count,
       organization_hk
FROM (
  SELECT s.kind, s.id, s.name, s.total_income, s.organization_hk,
         o.total_income AS organization_income,
         o.client_count,
         o.firm_count,
         row_number() OVER (
           PARTITION BY s.kind, coalesce(s.organization_hk, s.id)
           ORDER BY s.total_income DESC, s.id
         ) AS organization_row
  FROM workspace.gold.search_entity s
  LEFT JOIN workspace.gold.organization o ON o.organization_hk = s.organization_hk
  WHERE s.kind IN ('client', 'firm')
    AND lower(s.name) LIKE concat('%', lower(:q), '%')
)
WHERE organization_row = 1
ORDER BY total_income DESC
LIMIT 25
