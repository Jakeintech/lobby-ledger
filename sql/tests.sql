-- tests.sql
-- Data-quality assertions over the vault, in the spirit of dbt schema tests
-- (unique, not_null, relationships, accepted_values). Every query returns
-- the number of violating rows, so the expected output is a column of zeros.

SELECT 'hub_registrant unique key' AS test, count(*) - count(DISTINCT registrant_hk) AS failures FROM silver.hub_registrant
UNION ALL SELECT 'hub_client unique key', count(*) - count(DISTINCT client_hk) FROM silver.hub_client
UNION ALL SELECT 'hub_lobbyist unique key', count(*) - count(DISTINCT lobbyist_hk) FROM silver.hub_lobbyist
UNION ALL SELECT 'hub_issue unique key', count(*) - count(DISTINCT issue_hk) FROM silver.hub_issue
UNION ALL SELECT 'link_engagement unique key', count(*) - count(DISTINCT engagement_hk) FROM silver.link_engagement
UNION ALL SELECT 'link_engagement -> hub_registrant', count(*) FROM silver.link_engagement l
  WHERE NOT EXISTS (SELECT 1 FROM silver.hub_registrant h WHERE h.registrant_hk = l.registrant_hk)
UNION ALL SELECT 'link_engagement -> hub_client', count(*) FROM silver.link_engagement l
  WHERE NOT EXISTS (SELECT 1 FROM silver.hub_client h WHERE h.client_hk = l.client_hk)
UNION ALL SELECT 'link_engagement_lobbyist -> hub_lobbyist', count(*) FROM silver.link_engagement_lobbyist l
  WHERE NOT EXISTS (SELECT 1 FROM silver.hub_lobbyist h WHERE h.lobbyist_hk = l.lobbyist_hk)
UNION ALL SELECT 'link_engagement_issue -> hub_issue', count(*) FROM silver.link_engagement_issue l
  WHERE NOT EXISTS (SELECT 1 FROM silver.hub_issue h WHERE h.issue_hk = l.issue_hk)
UNION ALL SELECT 'sat_engagement_filing -> link_engagement', count(*) FROM silver.sat_engagement_filing s
  WHERE NOT EXISTS (SELECT 1 FROM silver.link_engagement l WHERE l.engagement_hk = s.engagement_hk)
UNION ALL SELECT 'sat_engagement_filing one version per hash_diff', count(*) - count(DISTINCT concat(filing_uuid, hash_diff)) FROM silver.sat_engagement_filing
UNION ALL SELECT 'sat_engagement_filing not_null keys', count(*) FROM silver.sat_engagement_filing
  WHERE engagement_hk IS NULL OR filing_uuid IS NULL OR hash_diff IS NULL OR filing_year IS NULL
UNION ALL SELECT 'filing_type matches LDA code pattern', count(*) FROM silver.sat_engagement_filing
  WHERE filing_type NOT RLIKE '^(RR|RA|Q[1-4][AY]?|[1-4](A|T|TA|TY)|MM|MA|YY|YA)$'
UNION ALL SELECT 'filing_period accepted values', count(*) FROM silver.sat_engagement_filing
  WHERE filing_period NOT IN ('first_quarter','second_quarter','third_quarter','fourth_quarter','mid_year','year_end')
UNION ALL SELECT 'fact_filing one row per engagement and period', count(*) - count(DISTINCT concat(engagement_hk, filing_year, filing_period)) FROM gold.fact_filing
UNION ALL SELECT 'engagement_status accepted values', count(*) FROM gold.sat_engagement_computed
  WHERE engagement_status NOT IN ('active','lapsed')
UNION ALL SELECT 'pit_engagement one filing per engagement and snapshot', count(*) - count(DISTINCT concat(engagement_hk, snapshot_date)) FROM gold.pit_engagement
UNION ALL SELECT 'experience_search one row per engagement', count(*) - count(DISTINCT engagement_hk) FROM gold.experience_search
UNION ALL SELECT 'experience_search covers every engagement', (SELECT count(*) FROM silver.link_engagement) - count(*) FROM gold.experience_search
UNION ALL SELECT 'engagement_ai_summary one per engagement', count(*) - count(DISTINCT engagement_hk) FROM gold.engagement_ai_summary
UNION ALL SELECT 'engagement_bill labels not_null', count(*) FROM gold.engagement_bill WHERE bill_label IS NULL;
