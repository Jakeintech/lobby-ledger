-- grants.sql
-- Unity Catalog grants for the app. The app's service principal reads Gold
-- only (ADR 0002). Views run with their owner's rights, so no Silver grant
-- is needed. The second block seeds engagement_access for a named user so
-- the on-behalf-of-user query has rows to show.
-- Run with: python3 sql/run_sql.py sql/grants.sql

GRANT USE CATALOG ON CATALOG workspace TO `594a34cd-6870-4e06-b707-93b4f9ddbadb`;
GRANT USE SCHEMA ON SCHEMA workspace.gold TO `594a34cd-6870-4e06-b707-93b4f9ddbadb`;
GRANT SELECT ON SCHEMA workspace.gold TO `594a34cd-6870-4e06-b707-93b4f9ddbadb`;

GRANT USE CATALOG ON CATALOG workspace TO `info@jakeawilliams.com`;
GRANT USE SCHEMA ON SCHEMA workspace.gold TO `info@jakeawilliams.com`;
GRANT SELECT ON SCHEMA workspace.gold TO `info@jakeawilliams.com`;

INSERT INTO gold.engagement_access
SELECT 'info@jakeawilliams.com', e.engagement_hk
FROM silver.link_engagement e
JOIN gold.dim_registrant r ON r.registrant_hk = e.registrant_hk
WHERE r.name NOT LIKE 'SQUIRE PATTON BOGGS%'
  AND NOT EXISTS (SELECT 1 FROM gold.engagement_access a
                  WHERE a.user_email = 'info@jakeawilliams.com' AND a.engagement_hk = e.engagement_hk);

SELECT user_email, count(*) FROM gold.engagement_access GROUP BY 1;
