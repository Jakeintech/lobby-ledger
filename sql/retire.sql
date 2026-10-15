-- retire.sql
-- One-time clean-up after the one-mart-per-page rebuild. Run once after
-- lakehouse.sql has built the new marts, then run lakehouse.sql again.
-- Not part of lakehouse.sql. Every statement is safe to repeat.
-- Run with: python3 sql/run_sql.py sql/retire.sql

-- Gold objects the rebuild replaced.
DROP VIEW IF EXISTS gold.experience_search_secure;
DROP VIEW IF EXISTS gold.experience_search;
DROP TABLE IF EXISTS gold.engagement_access;
DROP TABLE IF EXISTS gold.pit_engagement;
DROP TABLE IF EXISTS gold.bridge_registrant_client_lobbyist;
DROP TABLE IF EXISTS gold.sat_engagement_computed;
DROP TABLE IF EXISTS gold.dim_registrant;
DROP TABLE IF EXISTS gold.dim_client;
DROP TABLE IF EXISTS gold.dim_lobbyist;

-- The bill marts now carry the congress (bill_congress, bill_detail,
-- bill_milestone, bill_quarter, bill_engagement). The old bill mart is
-- dropped; lakehouse.sql replaces bill_quarter in place, so it is not
-- dropped here and stays online between runs.
DROP TABLE IF EXISTS gold.bill;

-- sat_engagement_lobbyist_filing once held two rows for a filing and
-- lobbyist when the covered position was filled on one issue row and
-- empty on another. The insert now collapses those before its guard, but
-- the guard keeps rows already there, so the duplicated keys are removed
-- here and the next lakehouse.sql run inserts one row per key.
DELETE FROM silver.sat_engagement_lobbyist_filing
WHERE concat_ws('||', filing_uuid, engagement_lobbyist_hk) IN (
  SELECT concat_ws('||', filing_uuid, engagement_lobbyist_hk) FROM silver.sat_engagement_lobbyist_filing
  GROUP BY filing_uuid, engagement_lobbyist_hk HAVING count(*) > 1);

SHOW TABLES IN gold;
