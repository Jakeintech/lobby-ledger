-- proof.sql
-- Three checks that show the vault behaves as designed.

-- 1. One engagement, many filings: same engagement_hk, one satellite row per filing.
SELECT engagement_hk, count(*) AS satellite_rows, count(DISTINCT filing_uuid) AS filings,
       min(filing_year) AS first_year, max(filing_year) AS last_year
FROM silver.sat_engagement_filing
GROUP BY engagement_hk
ORDER BY satellite_rows DESC
LIMIT 5;

-- 2. Reloading identical data inserts nothing: count before and after rerunning
--    the satellite insert is the same because hash_diff already exists.
SELECT count(*) AS sat_rows, count(DISTINCT concat(filing_uuid, hash_diff)) AS distinct_versions
FROM silver.sat_engagement_filing;

-- 3. Gold row counts.
SELECT 'experience_search' AS object, count(*) AS row_count FROM gold.experience_search
UNION ALL SELECT 'pit_engagement', count(*) FROM gold.pit_engagement
UNION ALL SELECT 'bridge', count(*) FROM gold.bridge_registrant_client_lobbyist
UNION ALL SELECT 'fact_filing', count(*) FROM gold.fact_filing
UNION ALL SELECT 'ai_summaries', count(*) FROM gold.engagement_ai_summary;
