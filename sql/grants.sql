-- grants.sql
-- Unity Catalog grants for the two app identities. Each reads Gold only
-- (ADR 0002) and nothing in Bronze or Silver:
--   594a34cd-6870-4e06-b707-93b4f9ddbadb  the Databricks Apps principal
--   3d0ab98e-1abe-4621-a845-9807d00403cc  lobby-public, the service
--                                         principal behind the public site
-- Both hosts run every query as their own identity. No on-behalf-of-user
-- queries, so no per-user grants and no per-user access table.
-- Run with: python3 sql/run_sql.py sql/grants.sql

GRANT USE CATALOG ON CATALOG workspace TO `594a34cd-6870-4e06-b707-93b4f9ddbadb`;
GRANT USE SCHEMA ON SCHEMA workspace.gold TO `594a34cd-6870-4e06-b707-93b4f9ddbadb`;
GRANT SELECT ON SCHEMA workspace.gold TO `594a34cd-6870-4e06-b707-93b4f9ddbadb`;

GRANT USE CATALOG ON CATALOG workspace TO `3d0ab98e-1abe-4621-a845-9807d00403cc`;
GRANT USE SCHEMA ON SCHEMA workspace.gold TO `3d0ab98e-1abe-4621-a845-9807d00403cc`;
GRANT SELECT ON SCHEMA workspace.gold TO `3d0ab98e-1abe-4621-a845-9807d00403cc`;

SHOW GRANTS ON SCHEMA workspace.gold;
