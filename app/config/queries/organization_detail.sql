-- @param id STRING
-- Organization page header: one organization with its totals across every client row and firm.
SELECT organization_hk, organization_name, client_count, firm_count, engagement_count,
       CAST(total_income AS DOUBLE) AS total_income,
       quarters_active, issue_codes, first_period, last_period
FROM workspace.gold.organization
WHERE organization_hk = :id
LIMIT 1
