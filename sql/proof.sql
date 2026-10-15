-- proof.sql
-- Checks that show the vault and the marts behave as designed.

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

-- 3. Silver row counts, identical across two runs.
SELECT 'hub_registrant' AS object, count(*) AS row_count FROM silver.hub_registrant
UNION ALL SELECT 'hub_client', count(*) FROM silver.hub_client
UNION ALL SELECT 'hub_lobbyist', count(*) FROM silver.hub_lobbyist
UNION ALL SELECT 'hub_issue', count(*) FROM silver.hub_issue
UNION ALL SELECT 'hub_government_entity', count(*) FROM silver.hub_government_entity
UNION ALL SELECT 'link_engagement', count(*) FROM silver.link_engagement
UNION ALL SELECT 'link_engagement_lobbyist', count(*) FROM silver.link_engagement_lobbyist
UNION ALL SELECT 'link_engagement_issue', count(*) FROM silver.link_engagement_issue
UNION ALL SELECT 'link_engagement_government_entity', count(*) FROM silver.link_engagement_government_entity
UNION ALL SELECT 'sat_engagement_filing', count(*) FROM silver.sat_engagement_filing
UNION ALL SELECT 'sat_engagement_issues_text', count(*) FROM silver.sat_engagement_issues_text
UNION ALL SELECT 'sat_engagement_lobbyist_filing', count(*) FROM silver.sat_engagement_lobbyist_filing;

-- 4. Gold row counts, one line per mart.
SELECT 'fact_filing' AS object, count(*) AS row_count FROM gold.fact_filing
UNION ALL SELECT 'engagement_quarter', count(*) FROM gold.engagement_quarter
UNION ALL SELECT 'engagement', count(*) FROM gold.engagement
UNION ALL SELECT 'engagement_bill', count(*) FROM gold.engagement_bill
UNION ALL SELECT 'engagement_ai_summary', count(*) FROM gold.engagement_ai_summary
UNION ALL SELECT 'filing_bill', count(*) FROM gold.filing_bill
UNION ALL SELECT 'topic', count(*) FROM gold.topic
UNION ALL SELECT 'topic_quarter', count(*) FROM gold.topic_quarter
UNION ALL SELECT 'topic_client', count(*) FROM gold.topic_client
UNION ALL SELECT 'topic_firm', count(*) FROM gold.topic_firm
UNION ALL SELECT 'topic_bill', count(*) FROM gold.topic_bill
UNION ALL SELECT 'bill', count(*) FROM gold.bill
UNION ALL SELECT 'bill_quarter', count(*) FROM gold.bill_quarter
UNION ALL SELECT 'client', count(*) FROM gold.client
UNION ALL SELECT 'client_quarter', count(*) FROM gold.client_quarter
UNION ALL SELECT 'firm', count(*) FROM gold.firm
UNION ALL SELECT 'firm_quarter', count(*) FROM gold.firm_quarter
UNION ALL SELECT 'lobbyist', count(*) FROM gold.lobbyist
UNION ALL SELECT 'lobbyist_engagement', count(*) FROM gold.lobbyist_engagement
UNION ALL SELECT 'search_entity', count(*) FROM gold.search_entity
UNION ALL SELECT 'issue_name', count(*) FROM gold.issue_name;

-- 5. The income attribution rule in one line: the sum over topics is larger
--    than the sum over engagements because a filing counts toward every
--    issue code it lists.
SELECT (SELECT sum(total_income) FROM gold.topic) AS income_summed_over_topics,
       (SELECT sum(total_income) FROM gold.engagement) AS income_summed_over_engagements;

-- 6. Status split and the newest quarter in the data.
SELECT engagement_status, count(*) AS engagements, max(last_period) AS newest_period
FROM gold.engagement GROUP BY engagement_status;
