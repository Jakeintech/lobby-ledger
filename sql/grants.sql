-- grants.sql
-- Unity Catalog grants for the two app identities. Each reads Gold only
-- (ADR 0002) and nothing in Bronze or Silver:
--   859d1473-c864-4903-8164-e7740612cea3  the Databricks Apps principal (app lobby-ledger)
--   3d0ab98e-1abe-4621-a845-9807d00403cc  lobby-public, the service
--                                         principal behind the public site
-- Both hosts run every query as their own identity. No on-behalf-of-user
-- queries, so no per-user grants and no per-user access table.
-- Run with: python3 sql/run_sql.py sql/grants.sql

GRANT USE CATALOG ON CATALOG workspace TO `859d1473-c864-4903-8164-e7740612cea3`;
GRANT USE SCHEMA ON SCHEMA workspace.gold TO `859d1473-c864-4903-8164-e7740612cea3`;
GRANT SELECT ON SCHEMA workspace.gold TO `859d1473-c864-4903-8164-e7740612cea3`;

GRANT USE CATALOG ON CATALOG workspace TO `3d0ab98e-1abe-4621-a845-9807d00403cc`;
GRANT USE SCHEMA ON SCHEMA workspace.gold TO `3d0ab98e-1abe-4621-a845-9807d00403cc`;
GRANT SELECT ON SCHEMA workspace.gold TO `3d0ab98e-1abe-4621-a845-9807d00403cc`;

SHOW GRANTS ON SCHEMA workspace.gold;
