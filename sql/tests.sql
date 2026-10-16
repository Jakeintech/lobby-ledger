-- tests.sql
-- Data-quality assertions over the vault and the Gold marts, in the spirit
-- of dbt schema tests (unique, not_null, relationships, accepted_values).
-- Every assertion returns the number of violating rows, so the expected
-- output is a column of zeros. One statement: the first row printed is
-- the total across every assertion (failing_assertions must be 0), then
-- any failing assertion, then the rest. sql/run_sql.py prints every row.

SELECT coalesce(t.test, 'TOTAL across all assertions') AS test,
       sum(t.failures) AS failures,
       sum(CASE WHEN t.failures <> 0 OR t.failures IS NULL THEN 1 ELSE 0 END) AS failing_assertions,
       count(*) AS assertions
FROM (

-- Silver: hubs, links and satellites keep their grain
SELECT 'hub_registrant unique key' AS test, count(*) - count(DISTINCT registrant_hk) AS failures FROM silver.hub_registrant
UNION ALL SELECT 'hub_client unique key', count(*) - count(DISTINCT client_hk) FROM silver.hub_client
UNION ALL SELECT 'hub_organization unique key', count(*) - count(DISTINCT organization_hk) FROM silver.hub_organization
UNION ALL SELECT 'hub_organization not_null key', count(*) FROM silver.hub_organization WHERE organization_hk IS NULL OR organization_bk IS NULL OR organization_bk = ''
UNION ALL SELECT 'link_client_organization unique key', count(*) - count(DISTINCT client_organization_hk) FROM silver.link_client_organization
UNION ALL SELECT 'link_client_organization -> hub_client', count(*) FROM silver.link_client_organization l
  WHERE NOT EXISTS (SELECT 1 FROM silver.hub_client h WHERE h.client_hk = l.client_hk)
UNION ALL SELECT 'link_client_organization -> hub_organization', count(*) FROM silver.link_client_organization l
  WHERE NOT EXISTS (SELECT 1 FROM silver.hub_organization h WHERE h.organization_hk = l.organization_hk)
UNION ALL SELECT 'every client maps to exactly one organization', count(*) FROM (
  SELECT hc.client_hk, count(DISTINCT l.organization_hk) AS organizations
  FROM silver.hub_client hc
  LEFT JOIN (SELECT client_hk, organization_hk FROM silver.link_client_organization
             QUALIFY row_number() OVER (PARTITION BY client_hk ORDER BY load_date DESC, organization_hk) = 1) l
    ON l.client_hk = hc.client_hk
  GROUP BY hc.client_hk) x WHERE organizations <> 1
UNION ALL SELECT 'hub_lobbyist unique key', count(*) - count(DISTINCT lobbyist_hk) FROM silver.hub_lobbyist
UNION ALL SELECT 'hub_issue unique key', count(*) - count(DISTINCT issue_hk) FROM silver.hub_issue
UNION ALL SELECT 'hub_government_entity unique key', count(*) - count(DISTINCT entity_hk) FROM silver.hub_government_entity
UNION ALL SELECT 'link_engagement unique key', count(*) - count(DISTINCT engagement_hk) FROM silver.link_engagement
UNION ALL SELECT 'link_engagement -> hub_registrant', count(*) FROM silver.link_engagement l
  WHERE NOT EXISTS (SELECT 1 FROM silver.hub_registrant h WHERE h.registrant_hk = l.registrant_hk)
UNION ALL SELECT 'link_engagement -> hub_client', count(*) FROM silver.link_engagement l
  WHERE NOT EXISTS (SELECT 1 FROM silver.hub_client h WHERE h.client_hk = l.client_hk)
UNION ALL SELECT 'link_engagement_lobbyist unique key', count(*) - count(DISTINCT engagement_lobbyist_hk) FROM silver.link_engagement_lobbyist
UNION ALL SELECT 'link_engagement_lobbyist -> hub_lobbyist', count(*) FROM silver.link_engagement_lobbyist l
  WHERE NOT EXISTS (SELECT 1 FROM silver.hub_lobbyist h WHERE h.lobbyist_hk = l.lobbyist_hk)
UNION ALL SELECT 'link_engagement_issue unique key', count(*) - count(DISTINCT engagement_issue_hk) FROM silver.link_engagement_issue
UNION ALL SELECT 'link_engagement_issue -> hub_issue', count(*) FROM silver.link_engagement_issue l
  WHERE NOT EXISTS (SELECT 1 FROM silver.hub_issue h WHERE h.issue_hk = l.issue_hk)
UNION ALL SELECT 'link_engagement_government_entity unique key', count(*) - count(DISTINCT engagement_entity_hk) FROM silver.link_engagement_government_entity
UNION ALL SELECT 'link_engagement_government_entity -> hub_government_entity', count(*) FROM silver.link_engagement_government_entity l
  WHERE NOT EXISTS (SELECT 1 FROM silver.hub_government_entity h WHERE h.entity_hk = l.entity_hk)
UNION ALL SELECT 'link_engagement_government_entity -> link_engagement', count(*) FROM silver.link_engagement_government_entity l
  WHERE NOT EXISTS (SELECT 1 FROM silver.link_engagement e WHERE e.engagement_hk = l.engagement_hk)
UNION ALL SELECT 'sat_engagement_filing -> link_engagement', count(*) FROM silver.sat_engagement_filing s
  WHERE NOT EXISTS (SELECT 1 FROM silver.link_engagement l WHERE l.engagement_hk = s.engagement_hk)
UNION ALL SELECT 'sat_engagement_filing one version per hash_diff', count(*) - count(DISTINCT filing_uuid, hash_diff) FROM silver.sat_engagement_filing
UNION ALL SELECT 'sat_engagement_filing not_null keys', count(*) FROM silver.sat_engagement_filing
  WHERE engagement_hk IS NULL OR filing_uuid IS NULL OR hash_diff IS NULL OR filing_year IS NULL
UNION ALL SELECT 'sat_engagement_issues_text one version per filing, issue and hash_diff', count(*) - count(DISTINCT filing_uuid, issue_code, hash_diff) FROM silver.sat_engagement_issues_text
UNION ALL SELECT 'sat_engagement_lobbyist_filing one row per filing and lobbyist', count(*) - count(DISTINCT filing_uuid, engagement_lobbyist_hk) FROM silver.sat_engagement_lobbyist_filing
UNION ALL SELECT 'sat_client_profile one version per hash_diff', count(*) - count(DISTINCT client_hk, hash_diff) FROM silver.sat_client_profile
UNION ALL SELECT 'sat_registrant_profile one version per hash_diff', count(*) - count(DISTINCT registrant_hk, hash_diff) FROM silver.sat_registrant_profile
UNION ALL SELECT 'sat_lobbyist_profile one version per hash_diff', count(*) - count(DISTINCT lobbyist_hk, hash_diff) FROM silver.sat_lobbyist_profile
UNION ALL SELECT 'sat_client_ppb one version per hash_diff', count(*) - count(DISTINCT client_hk, hash_diff) FROM silver.sat_client_ppb
UNION ALL SELECT 'sat_engagement_government_entity_filing one row per filing and entity', count(*) - count(DISTINCT filing_uuid, engagement_entity_hk) FROM silver.sat_engagement_government_entity_filing
UNION ALL SELECT 'sat_engagement_government_entity_filing -> link_engagement_government_entity', count(*) FROM silver.sat_engagement_government_entity_filing s
  WHERE NOT EXISTS (SELECT 1 FROM silver.link_engagement_government_entity l WHERE l.engagement_entity_hk = s.engagement_entity_hk)
UNION ALL SELECT 'hub_foreign_entity unique key', count(*) - count(DISTINCT foreign_entity_hk) FROM silver.hub_foreign_entity
UNION ALL SELECT 'link_engagement_foreign_entity unique key', count(*) - count(DISTINCT engagement_foreign_entity_hk) FROM silver.link_engagement_foreign_entity
UNION ALL SELECT 'link_engagement_foreign_entity -> hub_foreign_entity', count(*) FROM silver.link_engagement_foreign_entity l
  WHERE NOT EXISTS (SELECT 1 FROM silver.hub_foreign_entity h WHERE h.foreign_entity_hk = l.foreign_entity_hk)
UNION ALL SELECT 'link_engagement_foreign_entity -> link_engagement', count(*) FROM silver.link_engagement_foreign_entity l
  WHERE NOT EXISTS (SELECT 1 FROM silver.link_engagement e WHERE e.engagement_hk = l.engagement_hk)
UNION ALL SELECT 'sat_foreign_entity_filing one row per filing and entity', count(*) - count(DISTINCT filing_uuid, engagement_foreign_entity_hk) FROM silver.sat_foreign_entity_filing
UNION ALL SELECT 'hub_affiliated_organization unique key', count(*) - count(DISTINCT organization_hk) FROM silver.hub_affiliated_organization
UNION ALL SELECT 'link_engagement_affiliated_organization unique key', count(*) - count(DISTINCT engagement_organization_hk) FROM silver.link_engagement_affiliated_organization
UNION ALL SELECT 'link_engagement_affiliated_organization -> hub_affiliated_organization', count(*) FROM silver.link_engagement_affiliated_organization l
  WHERE NOT EXISTS (SELECT 1 FROM silver.hub_affiliated_organization h WHERE h.organization_hk = l.organization_hk)
UNION ALL SELECT 'sat_affiliated_organization_filing one row per filing and organization', count(*) - count(DISTINCT filing_uuid, engagement_organization_hk) FROM silver.sat_affiliated_organization_filing
UNION ALL SELECT 'hub_legislator unique key', count(*) - count(DISTINCT legislator_hk) FROM silver.hub_legislator
UNION ALL SELECT 'sat_legislator_profile one version per hash_diff', count(*) - count(DISTINCT legislator_hk, hash_diff) FROM silver.sat_legislator_profile
UNION ALL SELECT 'sat_legislator_profile type accepted values', count(*) FROM silver.sat_legislator_profile WHERE type NOT IN ('sen', 'rep')
UNION ALL SELECT 'hub_committee unique key', count(*) - count(DISTINCT committee_hk) FROM silver.hub_committee
UNION ALL SELECT 'sat_committee_profile one version per hash_diff', count(*) - count(DISTINCT committee_hk, hash_diff) FROM silver.sat_committee_profile
UNION ALL SELECT 'sat_committee_profile chamber accepted values', count(*) FROM silver.sat_committee_profile WHERE chamber NOT IN ('house', 'senate', 'joint')
UNION ALL SELECT 'hub_bill unique key', count(*) - count(DISTINCT bill_hk) FROM silver.hub_bill
UNION ALL SELECT 'hub_bill not_null parts', count(*) FROM silver.hub_bill WHERE congress IS NULL OR bill_key IS NULL
UNION ALL SELECT 'sat_bill_detail one version per hash_diff', count(*) - count(DISTINCT bill_hk, hash_diff) FROM silver.sat_bill_detail
UNION ALL SELECT 'sat_bill_detail -> hub_bill', count(*) FROM silver.sat_bill_detail s
  WHERE NOT EXISTS (SELECT 1 FROM silver.hub_bill h WHERE h.bill_hk = s.bill_hk)
UNION ALL SELECT 'sat_bill_action one row per bill and action', count(*) - count(DISTINCT bill_hk, hash_diff) FROM silver.sat_bill_action
UNION ALL SELECT 'sat_bill_action -> hub_bill', count(*) FROM silver.sat_bill_action s
  WHERE NOT EXISTS (SELECT 1 FROM silver.hub_bill h WHERE h.bill_hk = s.bill_hk)
UNION ALL SELECT 'filing_type matches LDA code pattern', count(*) FROM silver.sat_engagement_filing
  WHERE filing_type NOT RLIKE '^(RR|RA|Q[1-4][AY]?|[1-4](A|T|TA|TY|AY|@|@Y)|MM|MA|YY|YA)$'
UNION ALL SELECT 'filing_period accepted values', count(*) FROM silver.sat_engagement_filing
  WHERE filing_period NOT IN ('first_quarter','second_quarter','third_quarter','fourth_quarter','mid_year','year_end')

-- Gold: unique keys and not_null keys, one per mart
UNION ALL SELECT 'fact_filing one row per engagement and period', count(*) - count(DISTINCT engagement_hk, filing_year, filing_period) FROM gold.fact_filing
UNION ALL SELECT 'fact_filing not_null key', count(*) FROM gold.fact_filing
  WHERE filing_uuid IS NULL OR engagement_hk IS NULL OR period_end_date IS NULL
UNION ALL SELECT 'fact_filing holds no registration', count(*) FROM gold.fact_filing WHERE filing_type IN ('RR', 'RA')
UNION ALL SELECT 'fact_filing -> link_engagement', count(*) FROM gold.fact_filing f
  WHERE NOT EXISTS (SELECT 1 FROM silver.link_engagement l WHERE l.engagement_hk = f.engagement_hk)
UNION ALL SELECT 'filing_bill holds no superseded report', count(*) FROM gold.filing_bill fb
  JOIN silver.sat_engagement_filing s ON s.filing_uuid = fb.filing_uuid
  WHERE s.filing_type NOT IN ('RR', 'RA') AND fb.period_end_date IS NULL
UNION ALL SELECT 'engagement_quarter unique key', count(*) - count(DISTINCT engagement_hk, period_end_date) FROM gold.engagement_quarter
UNION ALL SELECT 'engagement_quarter not_null key', count(*) FROM gold.engagement_quarter WHERE engagement_hk IS NULL OR period_end_date IS NULL
UNION ALL SELECT 'engagement unique key', count(*) - count(DISTINCT engagement_hk) FROM gold.engagement
UNION ALL SELECT 'engagement not_null key', count(*) FROM gold.engagement WHERE engagement_hk IS NULL
UNION ALL SELECT 'engagement_bill unique key', count(*) - count(DISTINCT engagement_hk, bill_key) FROM gold.engagement_bill
UNION ALL SELECT 'engagement_bill not_null key', count(*) FROM gold.engagement_bill WHERE engagement_hk IS NULL OR bill_key IS NULL
UNION ALL SELECT 'engagement_ai_summary one per engagement', count(*) - count(DISTINCT engagement_hk) FROM gold.engagement_ai_summary
UNION ALL SELECT 'topic unique key', count(*) - count(DISTINCT issue_code) FROM gold.topic
UNION ALL SELECT 'topic not_null key', count(*) FROM gold.topic WHERE issue_code IS NULL
UNION ALL SELECT 'topic_quarter unique key', count(*) - count(DISTINCT issue_code, period_end_date) FROM gold.topic_quarter
UNION ALL SELECT 'topic_quarter not_null key', count(*) FROM gold.topic_quarter WHERE issue_code IS NULL OR period_end_date IS NULL
UNION ALL SELECT 'topic_client unique key', count(*) - count(DISTINCT issue_code, client_id) FROM gold.topic_client
UNION ALL SELECT 'topic_client not_null key', count(*) FROM gold.topic_client WHERE issue_code IS NULL OR client_id IS NULL
UNION ALL SELECT 'topic_firm unique key', count(*) - count(DISTINCT issue_code, registrant_id) FROM gold.topic_firm
UNION ALL SELECT 'topic_firm not_null key', count(*) FROM gold.topic_firm WHERE issue_code IS NULL OR registrant_id IS NULL
UNION ALL SELECT 'topic_bill unique key', count(*) - count(DISTINCT issue_code, bill_key) FROM gold.topic_bill
UNION ALL SELECT 'topic_bill not_null key', count(*) FROM gold.topic_bill WHERE issue_code IS NULL OR bill_key IS NULL
UNION ALL SELECT 'bill_congress unique key', count(*) - count(DISTINCT congress, bill_key) FROM gold.bill_congress
UNION ALL SELECT 'bill_congress not_null key', count(*) FROM gold.bill_congress WHERE congress IS NULL OR bill_key IS NULL
UNION ALL SELECT 'bill_detail unique key', count(*) - count(DISTINCT congress, bill_key) FROM gold.bill_detail
UNION ALL SELECT 'bill_detail not_null key', count(*) FROM gold.bill_detail WHERE congress IS NULL OR bill_key IS NULL
UNION ALL SELECT 'bill_milestone unique key', count(*) - count(DISTINCT congress, bill_key, milestone) FROM gold.bill_milestone
UNION ALL SELECT 'bill_milestone not_null key', count(*) FROM gold.bill_milestone WHERE congress IS NULL OR bill_key IS NULL OR milestone IS NULL
UNION ALL SELECT 'bill_milestone milestone_date not_null', count(*) FROM gold.bill_milestone WHERE milestone_date IS NULL
UNION ALL SELECT 'bill_quarter unique key', count(*) - count(DISTINCT congress, bill_key, period_end_date) FROM gold.bill_quarter
UNION ALL SELECT 'bill_quarter not_null key', count(*) FROM gold.bill_quarter WHERE congress IS NULL OR bill_key IS NULL OR period_end_date IS NULL
UNION ALL SELECT 'bill_engagement unique key', count(*) - count(DISTINCT congress, bill_key, engagement_hk) FROM gold.bill_engagement
UNION ALL SELECT 'bill_engagement not_null key', count(*) FROM gold.bill_engagement WHERE congress IS NULL OR bill_key IS NULL OR engagement_hk IS NULL
UNION ALL SELECT 'activity_text unique key', count(*) - count(DISTINCT filing_uuid, issue_code) FROM gold.activity_text
UNION ALL SELECT 'activity_text not_null key', count(*) FROM gold.activity_text WHERE filing_uuid IS NULL OR issue_code IS NULL OR period_end_date IS NULL
UNION ALL SELECT 'term unique key', count(*) - count(DISTINCT term) FROM gold.term
UNION ALL SELECT 'term not_null key', count(*) FROM gold.term WHERE term IS NULL
UNION ALL SELECT 'term_quarter unique key', count(*) - count(DISTINCT term, period_end_date) FROM gold.term_quarter
UNION ALL SELECT 'term_quarter not_null key', count(*) FROM gold.term_quarter WHERE term IS NULL OR period_end_date IS NULL
UNION ALL SELECT 'term_client unique key', count(*) - count(DISTINCT term, client_id) FROM gold.term_client
UNION ALL SELECT 'term_client not_null key', count(*) FROM gold.term_client WHERE term IS NULL OR client_id IS NULL
UNION ALL SELECT 'term_issue unique key', count(*) - count(DISTINCT term, issue_code) FROM gold.term_issue
UNION ALL SELECT 'term_issue not_null key', count(*) FROM gold.term_issue WHERE term IS NULL OR issue_code IS NULL
UNION ALL SELECT 'government_entity unique key', count(*) - count(DISTINCT entity_hk) FROM gold.government_entity
UNION ALL SELECT 'government_entity not_null key', count(*) FROM gold.government_entity WHERE entity_hk IS NULL OR entity_name IS NULL
UNION ALL SELECT 'government_entity_quarter unique key', count(*) - count(DISTINCT entity_hk, period_end_date) FROM gold.government_entity_quarter
UNION ALL SELECT 'government_entity_quarter not_null key', count(*) FROM gold.government_entity_quarter WHERE entity_hk IS NULL OR period_end_date IS NULL
UNION ALL SELECT 'government_entity_issue unique key', count(*) - count(DISTINCT entity_hk, issue_code) FROM gold.government_entity_issue
UNION ALL SELECT 'government_entity_issue not_null key', count(*) FROM gold.government_entity_issue WHERE entity_hk IS NULL OR issue_code IS NULL
UNION ALL SELECT 'government_entity_client unique key', count(*) - count(DISTINCT entity_hk, client_id) FROM gold.government_entity_client
UNION ALL SELECT 'government_entity_client not_null key', count(*) FROM gold.government_entity_client WHERE entity_hk IS NULL OR client_id IS NULL
UNION ALL SELECT 'foreign_country unique key', count(*) - count(DISTINCT country) FROM gold.foreign_country
UNION ALL SELECT 'foreign_country not_null key', count(*) FROM gold.foreign_country WHERE country IS NULL
UNION ALL SELECT 'foreign_country_quarter unique key', count(*) - count(DISTINCT country, period_end_date) FROM gold.foreign_country_quarter
UNION ALL SELECT 'foreign_country_quarter not_null key', count(*) FROM gold.foreign_country_quarter WHERE country IS NULL OR period_end_date IS NULL
UNION ALL SELECT 'foreign_country_client unique key', count(*) - count(DISTINCT country, client_id) FROM gold.foreign_country_client
UNION ALL SELECT 'foreign_country_client not_null key', count(*) FROM gold.foreign_country_client WHERE country IS NULL OR client_id IS NULL
UNION ALL SELECT 'lobbyist_position unique key', count(*) - count(DISTINCT lobbyist_id, position_text) FROM gold.lobbyist_position
UNION ALL SELECT 'lobbyist_position not_null key', count(*) FROM gold.lobbyist_position WHERE lobbyist_id IS NULL OR position_text IS NULL
UNION ALL SELECT 'lobbyist_affiliation unique key', count(*) - count(DISTINCT lobbyist_id, kind, ref_id) FROM gold.lobbyist_affiliation
UNION ALL SELECT 'lobbyist_affiliation not_null key', count(*) FROM gold.lobbyist_affiliation WHERE lobbyist_id IS NULL OR kind IS NULL OR ref_id IS NULL
UNION ALL SELECT 'revolving_door unique key', count(*) - count(DISTINCT lobbyist_id, engagement_hk) FROM gold.revolving_door
UNION ALL SELECT 'revolving_door not_null key', count(*) FROM gold.revolving_door WHERE lobbyist_id IS NULL OR engagement_hk IS NULL
UNION ALL SELECT 'client unique key', count(*) - count(DISTINCT client_id) FROM gold.client
UNION ALL SELECT 'client not_null key', count(*) FROM gold.client WHERE client_id IS NULL
UNION ALL SELECT 'client_quarter unique key', count(*) - count(DISTINCT client_id, period_end_date) FROM gold.client_quarter
UNION ALL SELECT 'client_quarter not_null key', count(*) FROM gold.client_quarter WHERE client_id IS NULL OR period_end_date IS NULL
UNION ALL SELECT 'firm unique key', count(*) - count(DISTINCT registrant_id) FROM gold.firm
UNION ALL SELECT 'firm not_null key', count(*) FROM gold.firm WHERE registrant_id IS NULL
UNION ALL SELECT 'firm_quarter unique key', count(*) - count(DISTINCT registrant_id, period_end_date) FROM gold.firm_quarter
UNION ALL SELECT 'firm_quarter not_null key', count(*) FROM gold.firm_quarter WHERE registrant_id IS NULL OR period_end_date IS NULL
UNION ALL SELECT 'lobbyist unique key', count(*) - count(DISTINCT lobbyist_id) FROM gold.lobbyist
UNION ALL SELECT 'lobbyist not_null key', count(*) FROM gold.lobbyist WHERE lobbyist_id IS NULL
UNION ALL SELECT 'lobbyist_engagement unique key', count(*) - count(DISTINCT lobbyist_id, engagement_hk) FROM gold.lobbyist_engagement
UNION ALL SELECT 'lobbyist_engagement not_null key', count(*) FROM gold.lobbyist_engagement WHERE lobbyist_id IS NULL OR engagement_hk IS NULL
UNION ALL SELECT 'search_entity unique key', count(*) - count(DISTINCT kind, id) FROM gold.search_entity
UNION ALL SELECT 'search_entity not_null key', count(*) FROM gold.search_entity WHERE kind IS NULL OR id IS NULL
UNION ALL SELECT 'issue_name unique key', count(*) - count(DISTINCT issue_code) FROM gold.issue_name
UNION ALL SELECT 'organization unique key', count(*) - count(DISTINCT organization_hk) FROM gold.organization
UNION ALL SELECT 'organization not_null key', count(*) FROM gold.organization WHERE organization_hk IS NULL OR organization_name IS NULL
UNION ALL SELECT 'organization_quarter unique key', count(*) - count(DISTINCT organization_hk, period_end_date) FROM gold.organization_quarter
UNION ALL SELECT 'organization_quarter not_null key', count(*) FROM gold.organization_quarter WHERE organization_hk IS NULL OR period_end_date IS NULL
UNION ALL SELECT 'organization_firm unique key', count(*) - count(DISTINCT organization_hk, registrant_id) FROM gold.organization_firm
UNION ALL SELECT 'organization_firm not_null key', count(*) FROM gold.organization_firm WHERE organization_hk IS NULL OR registrant_id IS NULL OR client_id IS NULL
UNION ALL SELECT 'issue_committee unique key', count(*) - count(DISTINCT issue_code, chamber, thomas_id) FROM gold.issue_committee
UNION ALL SELECT 'issue_committee not_null key', count(*) FROM gold.issue_committee WHERE issue_code IS NULL OR chamber IS NULL OR thomas_id IS NULL OR committee_name IS NULL
UNION ALL SELECT 'surge unique key', count(*) - count(DISTINCT kind, id, period_end_date) FROM gold.surge
UNION ALL SELECT 'surge not_null key', count(*) FROM gold.surge WHERE kind IS NULL OR id IS NULL OR period_end_date IS NULL OR name IS NULL
UNION ALL SELECT 'filing_timing unique key', count(*) - count(DISTINCT filing_uuid) FROM gold.filing_timing
UNION ALL SELECT 'filing_timing one row per engagement and period', count(*) - count(DISTINCT engagement_hk, period_end_date) FROM gold.filing_timing
UNION ALL SELECT 'filing_timing not_null key', count(*) FROM gold.filing_timing
  WHERE filing_uuid IS NULL OR engagement_hk IS NULL OR registrant_id IS NULL OR client_id IS NULL OR period_end_date IS NULL
     OR due_date IS NULL OR due_date_observed IS NULL
UNION ALL SELECT 'peer_rank unique key', count(*) - count(DISTINCT kind, id, issue_code) FROM gold.peer_rank
UNION ALL SELECT 'peer_rank not_null key', count(*) FROM gold.peer_rank WHERE kind IS NULL OR id IS NULL OR issue_code IS NULL OR pct_rank IS NULL
UNION ALL SELECT 'edge unique key', count(*) - count(DISTINCT src_kind, src_id, dst_kind, dst_id) FROM gold.edge
UNION ALL SELECT 'edge not_null key', count(*) FROM gold.edge WHERE src_kind IS NULL OR src_id IS NULL OR dst_kind IS NULL OR dst_id IS NULL OR weight IS NULL

-- Gold: coverage and relationships
UNION ALL SELECT 'engagement covers every link_engagement', count(*) FROM silver.link_engagement e
  WHERE NOT EXISTS (SELECT 1 FROM gold.engagement g WHERE g.engagement_hk = e.engagement_hk)
UNION ALL SELECT 'engagement_quarter -> engagement', count(*) FROM gold.engagement_quarter q
  WHERE NOT EXISTS (SELECT 1 FROM gold.engagement g WHERE g.engagement_hk = q.engagement_hk)
UNION ALL SELECT 'topic_quarter -> topic', count(*) FROM gold.topic_quarter q
  WHERE NOT EXISTS (SELECT 1 FROM gold.topic t WHERE t.issue_code = q.issue_code)
UNION ALL SELECT 'topic_client -> topic', count(*) FROM gold.topic_client c
  WHERE NOT EXISTS (SELECT 1 FROM gold.topic t WHERE t.issue_code = c.issue_code)
UNION ALL SELECT 'topic_firm -> topic', count(*) FROM gold.topic_firm f
  WHERE NOT EXISTS (SELECT 1 FROM gold.topic t WHERE t.issue_code = f.issue_code)
UNION ALL SELECT 'topic_bill -> bill_congress', count(*) FROM gold.topic_bill b
  WHERE NOT EXISTS (SELECT 1 FROM gold.bill_congress x WHERE x.bill_key = b.bill_key)
UNION ALL SELECT 'engagement_bill -> bill_congress', count(*) FROM gold.engagement_bill b
  WHERE NOT EXISTS (SELECT 1 FROM gold.bill_congress x WHERE x.bill_key = b.bill_key)
UNION ALL SELECT 'bill_quarter -> bill_congress', count(*) FROM gold.bill_quarter q
  WHERE NOT EXISTS (SELECT 1 FROM gold.bill_congress b WHERE b.congress = q.congress AND b.bill_key = q.bill_key)
UNION ALL SELECT 'bill_engagement -> bill_congress', count(*) FROM gold.bill_engagement e
  WHERE NOT EXISTS (SELECT 1 FROM gold.bill_congress b WHERE b.congress = e.congress AND b.bill_key = e.bill_key)
UNION ALL SELECT 'bill_engagement -> engagement', count(*) FROM gold.bill_engagement e
  WHERE NOT EXISTS (SELECT 1 FROM gold.engagement g WHERE g.engagement_hk = e.engagement_hk)
UNION ALL SELECT 'bill_detail -> bill_congress', count(*) FROM gold.bill_detail d
  WHERE NOT EXISTS (SELECT 1 FROM gold.bill_congress b WHERE b.congress = d.congress AND b.bill_key = d.bill_key)
UNION ALL SELECT 'bill_milestone -> hub_bill', count(*) FROM gold.bill_milestone m
  WHERE NOT EXISTS (SELECT 1 FROM silver.hub_bill h WHERE h.congress = m.congress AND h.bill_key = m.bill_key)
UNION ALL SELECT 'bill_congress covers every filing_bill key', count(*) FROM (SELECT DISTINCT bill_key FROM gold.filing_bill) f
  WHERE NOT EXISTS (SELECT 1 FROM gold.bill_congress b WHERE b.bill_key = f.bill_key)
UNION ALL SELECT 'term_quarter -> term', count(*) FROM gold.term_quarter q
  WHERE NOT EXISTS (SELECT 1 FROM gold.term t WHERE t.term = q.term)
UNION ALL SELECT 'term_client -> term', count(*) FROM gold.term_client c
  WHERE NOT EXISTS (SELECT 1 FROM gold.term t WHERE t.term = c.term)
UNION ALL SELECT 'term_issue -> term', count(*) FROM gold.term_issue i
  WHERE NOT EXISTS (SELECT 1 FROM gold.term t WHERE t.term = i.term)
UNION ALL SELECT 'term_quarter filings sum to term', count(*) FROM gold.term t
  WHERE t.filings_mentioning <> (SELECT coalesce(sum(q.filings_mentioning), 0) FROM gold.term_quarter q WHERE q.term = t.term)
UNION ALL SELECT 'term_quarter income sums to term', count(*) FROM gold.term t
  WHERE t.income <> (SELECT coalesce(sum(q.income), 0) FROM gold.term_quarter q WHERE q.term = t.term)
UNION ALL SELECT 'term covers every curated term', count(*) FROM gold.curated_term c
  WHERE NOT EXISTS (SELECT 1 FROM gold.term t WHERE t.term = c.term)
UNION ALL SELECT 'term filings_mentioning equals distinct filings in activity_text matching the term', count(*) FROM gold.term t
  WHERE t.filings_mentioning <> (SELECT count(DISTINCT a.filing_uuid) FROM gold.activity_text a WHERE a.text_lower LIKE concat('%', t.term, '%'))
UNION ALL SELECT 'government_entity_quarter -> government_entity', count(*) FROM gold.government_entity_quarter q
  WHERE NOT EXISTS (SELECT 1 FROM gold.government_entity g WHERE g.entity_hk = q.entity_hk)
UNION ALL SELECT 'government_entity_issue -> government_entity', count(*) FROM gold.government_entity_issue i
  WHERE NOT EXISTS (SELECT 1 FROM gold.government_entity g WHERE g.entity_hk = i.entity_hk)
UNION ALL SELECT 'government_entity_client -> government_entity', count(*) FROM gold.government_entity_client c
  WHERE NOT EXISTS (SELECT 1 FROM gold.government_entity g WHERE g.entity_hk = c.entity_hk)
UNION ALL SELECT 'government_entity covers every hub_government_entity', count(*) FROM silver.hub_government_entity h
  WHERE NOT EXISTS (SELECT 1 FROM gold.government_entity g WHERE g.entity_hk = h.entity_hk)
UNION ALL SELECT 'government_entity income equals the sum of its quarters', count(*) FROM gold.government_entity g
  WHERE g.income <> (SELECT coalesce(sum(q.income), 0) FROM gold.government_entity_quarter q WHERE q.entity_hk = g.entity_hk)
UNION ALL SELECT 'foreign_country_quarter -> foreign_country', count(*) FROM gold.foreign_country_quarter q
  WHERE NOT EXISTS (SELECT 1 FROM gold.foreign_country c WHERE c.country = q.country)
UNION ALL SELECT 'foreign_country_client -> foreign_country', count(*) FROM gold.foreign_country_client x
  WHERE NOT EXISTS (SELECT 1 FROM gold.foreign_country c WHERE c.country = x.country)
UNION ALL SELECT 'foreign_country income equals the sum of its clients within rounding', count(*) FROM gold.foreign_country c
  WHERE abs(c.income - (SELECT coalesce(sum(x.income), 0) FROM gold.foreign_country_client x WHERE x.country = c.country)) >= 1
UNION ALL SELECT 'foreign_country income equals the sum of its quarters', count(*) FROM gold.foreign_country c
  WHERE c.income <> (SELECT coalesce(sum(q.income), 0) FROM gold.foreign_country_quarter q WHERE q.country = c.country)
UNION ALL SELECT 'lobbyist_position -> lobbyist', count(*) FROM gold.lobbyist_position p
  WHERE NOT EXISTS (SELECT 1 FROM gold.lobbyist l WHERE l.lobbyist_id = p.lobbyist_id)
UNION ALL SELECT 'lobbyist_affiliation -> lobbyist', count(*) FROM gold.lobbyist_affiliation a
  WHERE NOT EXISTS (SELECT 1 FROM gold.lobbyist l WHERE l.lobbyist_id = a.lobbyist_id)
UNION ALL SELECT 'lobbyist_affiliation committee -> hub_committee', count(*) FROM gold.lobbyist_affiliation a
  WHERE a.kind = 'committee' AND NOT EXISTS (SELECT 1 FROM silver.hub_committee h WHERE h.committee_bk = a.ref_id)
UNION ALL SELECT 'lobbyist_affiliation member -> hub_legislator', count(*) FROM gold.lobbyist_affiliation a
  WHERE a.kind = 'member' AND NOT EXISTS (SELECT 1 FROM silver.hub_legislator h WHERE h.legislator_bk = a.ref_id)
UNION ALL SELECT 'lobbyist_affiliation agency -> hub_government_entity', count(*) FROM gold.lobbyist_affiliation a
  WHERE a.kind = 'agency' AND NOT EXISTS (SELECT 1 FROM silver.hub_government_entity h WHERE h.entity_hk = a.ref_id)
UNION ALL SELECT 'lobbyist affiliation_count equals its affiliations', count(*) FROM gold.lobbyist l
  WHERE l.affiliation_count <> (SELECT count(*) FROM gold.lobbyist_affiliation a WHERE a.lobbyist_id = l.lobbyist_id)
UNION ALL SELECT 'revolving_door -> lobbyist_engagement', count(*) FROM gold.revolving_door r
  WHERE NOT EXISTS (SELECT 1 FROM gold.lobbyist_engagement le WHERE le.lobbyist_id = r.lobbyist_id AND le.engagement_hk = r.engagement_hk)
UNION ALL SELECT 'revolving_door covers every lobbyist with an affiliation and an engagement', count(*) FROM gold.lobbyist_engagement le
  WHERE EXISTS (SELECT 1 FROM gold.lobbyist_affiliation a WHERE a.lobbyist_id = le.lobbyist_id)
    AND NOT EXISTS (SELECT 1 FROM gold.revolving_door r WHERE r.lobbyist_id = le.lobbyist_id AND r.engagement_hk = le.engagement_hk)
UNION ALL SELECT 'client_quarter -> client', count(*) FROM gold.client_quarter q
  WHERE NOT EXISTS (SELECT 1 FROM gold.client c WHERE c.client_id = q.client_id)
UNION ALL SELECT 'firm_quarter -> firm', count(*) FROM gold.firm_quarter q
  WHERE NOT EXISTS (SELECT 1 FROM gold.firm f WHERE f.registrant_id = q.registrant_id)
UNION ALL SELECT 'lobbyist_engagement -> lobbyist', count(*) FROM gold.lobbyist_engagement le
  WHERE NOT EXISTS (SELECT 1 FROM gold.lobbyist l WHERE l.lobbyist_id = le.lobbyist_id)
UNION ALL SELECT 'lobbyist_engagement -> engagement', count(*) FROM gold.lobbyist_engagement le
  WHERE NOT EXISTS (SELECT 1 FROM gold.engagement g WHERE g.engagement_hk = le.engagement_hk)
UNION ALL SELECT 'engagement client and firm -> client and firm', count(*) FROM gold.engagement g
  WHERE NOT EXISTS (SELECT 1 FROM gold.client c WHERE c.client_id = g.client_id)
     OR NOT EXISTS (SELECT 1 FROM gold.firm f WHERE f.registrant_id = g.registrant_id)
UNION ALL SELECT 'topic -> issue_name', count(*) FROM gold.topic t
  WHERE NOT EXISTS (SELECT 1 FROM gold.issue_name n WHERE n.issue_code = t.issue_code)
UNION ALL SELECT 'client organization not_null', count(*) FROM gold.client WHERE organization_hk IS NULL OR organization_name IS NULL
UNION ALL SELECT 'client -> organization', count(*) FROM gold.client c
  WHERE NOT EXISTS (SELECT 1 FROM gold.organization o WHERE o.organization_hk = c.organization_hk)
UNION ALL SELECT 'client organization_name matches organization', count(*) FROM gold.client c
  JOIN gold.organization o ON o.organization_hk = c.organization_hk WHERE o.organization_name <> c.organization_name
UNION ALL SELECT 'organization covers every hub_organization with a client', count(*) FROM silver.hub_organization h
  WHERE EXISTS (SELECT 1 FROM gold.client c WHERE c.organization_hk = h.organization_hk)
    AND NOT EXISTS (SELECT 1 FROM gold.organization o WHERE o.organization_hk = h.organization_hk)
UNION ALL SELECT 'organization client_count equals its client rows', count(*) FROM gold.organization o
  JOIN (SELECT organization_hk, count(*) AS n FROM gold.client GROUP BY organization_hk) c ON c.organization_hk = o.organization_hk
  WHERE c.n <> o.client_count
UNION ALL SELECT 'organization total_income equals the sum of its clients', count(*) FROM gold.organization o
  JOIN (SELECT organization_hk, sum(total_income) AS income FROM gold.client GROUP BY organization_hk) c ON c.organization_hk = o.organization_hk
  WHERE c.income <> o.total_income
UNION ALL SELECT 'organization total_income equals the sum of its quarters', count(*) FROM gold.organization o
  LEFT JOIN (SELECT organization_hk, sum(income) AS income FROM gold.organization_quarter GROUP BY organization_hk) q ON q.organization_hk = o.organization_hk
  WHERE coalesce(q.income, 0) <> o.total_income
UNION ALL SELECT 'organization firm_count equals its organization_firm rows', count(*) FROM gold.organization o
  LEFT JOIN (SELECT organization_hk, count(*) AS n FROM gold.organization_firm GROUP BY organization_hk) f ON f.organization_hk = o.organization_hk
  WHERE coalesce(f.n, 0) <> o.firm_count
UNION ALL SELECT 'organization_quarter -> organization', count(*) FROM gold.organization_quarter q
  WHERE NOT EXISTS (SELECT 1 FROM gold.organization o WHERE o.organization_hk = q.organization_hk)
UNION ALL SELECT 'organization_firm -> organization', count(*) FROM gold.organization_firm f
  WHERE NOT EXISTS (SELECT 1 FROM gold.organization o WHERE o.organization_hk = f.organization_hk)
UNION ALL SELECT 'organization_firm -> firm and client', count(*) FROM gold.organization_firm f
  WHERE NOT EXISTS (SELECT 1 FROM gold.firm x WHERE x.registrant_id = f.registrant_id)
     OR NOT EXISTS (SELECT 1 FROM gold.client c WHERE c.client_id = f.client_id AND c.organization_hk = f.organization_hk)
UNION ALL SELECT 'search_entity client carries its organization', count(*) FROM gold.search_entity
  WHERE (kind = 'client' AND (organization_hk IS NULL OR organization_name IS NULL))
     OR (kind = 'firm' AND organization_hk IS NOT NULL)
UNION ALL SELECT 'issue_committee -> issue_name', count(*) FROM gold.issue_committee i
  WHERE NOT EXISTS (SELECT 1 FROM gold.issue_name n WHERE n.issue_code = i.issue_code)
UNION ALL SELECT 'issue_committee -> hub_committee', count(*) FROM gold.issue_committee i
  WHERE NOT EXISTS (SELECT 1 FROM silver.hub_committee h WHERE h.committee_bk = i.thomas_id)
UNION ALL SELECT 'issue_committee chamber agrees with the committee reference', count(*) FROM gold.issue_committee i
  JOIN silver.hub_committee h ON h.committee_bk = i.thomas_id
  JOIN silver.sat_committee_profile p ON p.committee_hk = h.committee_hk
  WHERE p.chamber <> i.chamber
UNION ALL SELECT 'issue_committee names standing committees only (no subcommittee)', count(*) FROM gold.issue_committee i
  JOIN silver.hub_committee h ON h.committee_bk = i.thomas_id
  JOIN silver.sat_committee_profile p ON p.committee_hk = h.committee_hk
  WHERE p.parent_id IS NOT NULL
UNION ALL SELECT 'every issue code maps to at least one committee per chamber', count(*) FROM gold.issue_name n
  WHERE NOT EXISTS (SELECT 1 FROM gold.issue_committee i WHERE i.issue_code = n.issue_code AND i.chamber = 'house')
     OR NOT EXISTS (SELECT 1 FROM gold.issue_committee i WHERE i.issue_code = n.issue_code AND i.chamber = 'senate')
UNION ALL SELECT 'lobbyist_affiliation committee carries its jurisdiction issues', count(*) FROM gold.lobbyist_affiliation a
  WHERE (a.kind = 'committee' AND a.jurisdiction_issues IS NULL
         AND EXISTS (SELECT 1 FROM gold.issue_committee i WHERE i.thomas_id = a.ref_id))
     OR (a.kind <> 'committee' AND a.jurisdiction_issues IS NOT NULL)
UNION ALL SELECT 'revolving_door jurisdiction_match not_null', count(*) FROM gold.revolving_door WHERE jurisdiction_match IS NULL
UNION ALL SELECT 'revolving_door jurisdiction_match only with a committee affiliation', count(*) FROM gold.revolving_door r
  WHERE r.jurisdiction_match AND NOT EXISTS (SELECT 1 FROM gold.lobbyist_affiliation a WHERE a.lobbyist_id = r.lobbyist_id AND a.kind = 'committee')
UNION ALL SELECT 'surge -> client, firm or topic', count(*) FROM gold.surge s
  WHERE NOT ((s.kind = 'client' AND EXISTS (SELECT 1 FROM gold.client c WHERE c.client_id = s.id))
          OR (s.kind = 'firm' AND EXISTS (SELECT 1 FROM gold.firm f WHERE f.registrant_id = s.id))
          OR (s.kind = 'issue' AND EXISTS (SELECT 1 FROM gold.topic t WHERE t.issue_code = s.id)))
UNION ALL SELECT 'surge income equals the quarter it scores', count(*) FROM gold.surge s
  LEFT JOIN gold.client_quarter cq ON s.kind = 'client' AND cq.client_id = s.id AND cq.period_end_date = s.period_end_date
  LEFT JOIN gold.firm_quarter fq ON s.kind = 'firm' AND fq.registrant_id = s.id AND fq.period_end_date = s.period_end_date
  LEFT JOIN gold.topic_quarter tq ON s.kind = 'issue' AND tq.issue_code = s.id AND tq.period_end_date = s.period_end_date
  WHERE coalesce(cq.income, fq.income, tq.income) IS NULL OR coalesce(cq.income, fq.income, tq.income) <> s.income
UNION ALL SELECT 'surge has at least three prior quarters', count(*) FROM (
  SELECT s.kind, s.id, s.period_end_date, count(q.period_end_date) AS prior_quarters
  FROM gold.surge s
  LEFT JOIN (SELECT 'client' AS kind, client_id AS id, period_end_date FROM gold.client_quarter
             UNION ALL SELECT 'firm', registrant_id, period_end_date FROM gold.firm_quarter
             UNION ALL SELECT 'issue', issue_code, period_end_date FROM gold.topic_quarter) q
    ON q.kind = s.kind AND q.id = s.id AND q.period_end_date < s.period_end_date
  GROUP BY s.kind, s.id, s.period_end_date) x WHERE prior_quarters < 3
UNION ALL SELECT 'filing_timing -> fact_filing by engagement and period', count(*) FROM gold.filing_timing t
  WHERE NOT EXISTS (SELECT 1 FROM gold.fact_filing f WHERE f.engagement_hk = t.engagement_hk AND f.period_end_date = t.period_end_date)
UNION ALL SELECT 'filing_timing covers every fact_filing row', count(*) FROM gold.fact_filing f
  WHERE NOT EXISTS (SELECT 1 FROM gold.filing_timing t WHERE t.engagement_hk = f.engagement_hk AND t.period_end_date = f.period_end_date)
UNION ALL SELECT 'filing_timing filing_uuid is a quarterly report of that engagement', count(*) FROM gold.filing_timing t
  WHERE NOT EXISTS (SELECT 1 FROM silver.sat_engagement_filing s
                    WHERE s.filing_uuid = t.filing_uuid AND s.engagement_hk = t.engagement_hk AND s.filing_type NOT IN ('RR', 'RA'))
UNION ALL SELECT 'filing_timing filing_uuid is the first-posted version of its period', count(*) FROM gold.filing_timing t
  JOIN silver.sat_engagement_filing s0 ON s0.filing_uuid = t.filing_uuid
  JOIN silver.sat_engagement_filing s ON s.engagement_hk = t.engagement_hk
    AND s.filing_year = s0.filing_year AND s.filing_period = s0.filing_period
    AND s.filing_type NOT IN ('RR', 'RA') AND s.dt_posted < s0.dt_posted
UNION ALL SELECT 'filing_timing posted_date is the Eastern-time day of dt_posted', count(*) FROM gold.filing_timing t
  JOIN silver.sat_engagement_filing s ON s.filing_uuid = t.filing_uuid
  WHERE t.posted_date <> CAST(convert_timezone('America/New_York', s.dt_posted) AS DATE)
     OR t.posted_weekday <> date_format(convert_timezone('America/New_York', s.dt_posted), 'EEEE')
     OR t.posted_hour_utc <> hour(convert_timezone('UTC', s.dt_posted))
UNION ALL SELECT 'surge mean_prior is the mean of the prior quarters', count(*) FROM (
  SELECT s.kind, s.id, s.period_end_date, s.mean_prior, avg(q.income) AS recomputed
  FROM gold.surge s
  JOIN (SELECT 'client' AS kind, client_id AS id, period_end_date, income FROM gold.client_quarter
        UNION ALL SELECT 'firm', registrant_id, period_end_date, income FROM gold.firm_quarter
        UNION ALL SELECT 'issue', issue_code, period_end_date, income FROM gold.topic_quarter) q
    ON q.kind = s.kind AND q.id = s.id AND q.period_end_date < s.period_end_date
  GROUP BY s.kind, s.id, s.period_end_date, s.mean_prior) x WHERE abs(recomputed - mean_prior) > 0.01
UNION ALL SELECT 'peer_rank -> topic_firm or topic_client', count(*) FROM gold.peer_rank p
  WHERE NOT ((p.kind = 'firm' AND EXISTS (SELECT 1 FROM gold.topic_firm t WHERE t.registrant_id = p.id AND t.issue_code = p.issue_code AND t.income = p.income))
          OR (p.kind = 'client' AND EXISTS (SELECT 1 FROM gold.topic_client t WHERE t.client_id = p.id AND t.issue_code = p.issue_code AND t.income = p.income)))
UNION ALL SELECT 'edge client-firm covers every engagement', count(*) FROM gold.engagement g
  WHERE NOT EXISTS (SELECT 1 FROM gold.edge e WHERE e.src_kind = 'client' AND e.src_id = g.client_id AND e.dst_kind = 'firm' AND e.dst_id = g.registrant_id)
UNION ALL SELECT 'edge engagement-bill -> bill_engagement', count(*) FROM gold.edge e
  WHERE e.src_kind = 'engagement'
    AND NOT EXISTS (SELECT 1 FROM gold.bill_engagement b
                    WHERE b.engagement_hk = e.src_id AND concat(CAST(b.congress AS STRING), '-', b.bill_key) = e.dst_id)
UNION ALL SELECT 'edge lobbyist-engagement -> lobbyist_engagement', count(*) FROM gold.edge e
  WHERE e.src_kind = 'lobbyist'
    AND NOT EXISTS (SELECT 1 FROM gold.lobbyist_engagement le WHERE le.lobbyist_id = e.src_id AND le.engagement_hk = e.dst_id)

-- Gold: accepted values and formats
UNION ALL SELECT 'engagement_status accepted values', count(*) FROM gold.engagement
  WHERE engagement_status NOT IN ('active','lapsed')
UNION ALL SELECT 'search_entity kind accepted values', count(*) FROM gold.search_entity
  WHERE kind NOT IN ('client','firm')
UNION ALL SELECT 'bill_congress key has a prefix in the type map', count(*) FROM gold.bill_congress
  WHERE bill_key NOT RLIKE '^(HR|S|HJRES|SJRES|HCONRES|SCONRES|HRES|SRES)[0-9]{1,5}$'
UNION ALL SELECT 'bill_congress congress is the 118th or later', count(*) FROM gold.bill_congress WHERE congress < 118
UNION ALL SELECT 'bill_milestone accepted values', count(*) FROM gold.bill_milestone
  WHERE milestone NOT IN ('introduced', 'reported', 'passed_house', 'passed_senate', 'to_president', 'became_law')
UNION ALL SELECT 'bill_detail stage accepted values', count(*) FROM gold.bill_detail
  WHERE stage NOT IN ('introduced', 'in committee', 'passed one chamber', 'passed both', 'law')
UNION ALL SELECT 'government_entity chamber_or_agency accepted values', count(*) FROM gold.government_entity
  WHERE chamber_or_agency NOT IN ('House', 'Senate', 'White House', 'Agency')
UNION ALL SELECT 'government_entity rank is 1..n', count(*) - count(DISTINCT rank)
  + coalesce(sum(CASE WHEN rank < 1 THEN 1 ELSE 0 END), 0) + greatest(coalesce(max(rank), 0) - count(*), 0) FROM gold.government_entity
UNION ALL SELECT 'foreign_country rank is 1..n', count(*) - count(DISTINCT rank)
  + coalesce(sum(CASE WHEN rank < 1 THEN 1 ELSE 0 END), 0) + greatest(coalesce(max(rank), 0) - count(*), 0) FROM gold.foreign_country
UNION ALL SELECT 'lobbyist_affiliation kind accepted values', count(*) FROM gold.lobbyist_affiliation
  WHERE kind NOT IN ('committee', 'member', 'agency')
UNION ALL SELECT 'lobbyist_affiliation confidence accepted values', count(*) FROM gold.lobbyist_affiliation
  WHERE confidence NOT IN ('high', 'medium')
UNION ALL SELECT 'lobbyist_affiliation ref_name and matched_text not_null', count(*) FROM gold.lobbyist_affiliation
  WHERE ref_name IS NULL OR matched_text IS NULL
UNION ALL SELECT 'lobbyist lobbies_former_employer not_null', count(*) FROM gold.lobbyist
  WHERE lobbies_former_employer IS NULL OR affiliation_count IS NULL
UNION ALL SELECT 'revolving_door lobbies_former_employer not_null', count(*) FROM gold.revolving_door WHERE lobbies_former_employer IS NULL
UNION ALL SELECT 'term is lower case', count(*) FROM gold.term WHERE term <> lower(term)
UNION ALL SELECT 'engagement_bill key matches the bill pattern', count(*) FROM gold.engagement_bill
  WHERE bill_key NOT RLIKE '^(HR|S|HJRES|SJRES|HCONRES|SCONRES|HRES|SRES)[0-9]{1,5}$'
UNION ALL SELECT 'engagement_bill labels not_null', count(*) FROM gold.engagement_bill WHERE bill_label IS NULL
UNION ALL SELECT 'topic rank is 1..n', count(*) - count(DISTINCT rank)
  + sum(CASE WHEN rank < 1 THEN 1 ELSE 0 END) + greatest(max(rank) - count(*), 0) FROM gold.topic
UNION ALL SELECT 'engagement not_null names', count(*) FROM gold.engagement
  WHERE client IS NULL OR firm IS NULL OR client_id IS NULL OR registrant_id IS NULL
UNION ALL SELECT 'issue_committee chamber accepted values', count(*) FROM gold.issue_committee WHERE chamber NOT IN ('house', 'senate')
UNION ALL SELECT 'surge kind accepted values', count(*) FROM gold.surge WHERE kind NOT IN ('client', 'firm', 'issue')
UNION ALL SELECT 'surge is_surge agrees with z', count(*) FROM gold.surge
  WHERE is_surge IS NULL OR is_surge <> coalesce(z >= 2, false)
UNION ALL SELECT 'surge z null only when the prior deviation is zero', count(*) FROM gold.surge
  WHERE (z IS NULL AND stddev_prior <> 0) OR (z IS NOT NULL AND stddev_prior = 0) OR mean_prior IS NULL OR stddev_prior IS NULL
UNION ALL SELECT 'filing_timing due_date is period_end_date plus 20 days', count(*) FROM gold.filing_timing
  WHERE due_date <> date_add(period_end_date, 20)
UNION ALL SELECT 'filing_timing due_date_observed is the next business day on or after due_date', count(*) FROM gold.filing_timing
  WHERE due_date_observed IS NULL OR due_date_observed < due_date OR due_date_observed > date_add(due_date, 3)
     OR dayofweek(due_date_observed) IN (1, 7)
     OR (month(due_date_observed) = 1 AND dayofweek(due_date_observed) = 2 AND day(due_date_observed) BETWEEN 15 AND 21)
     OR (dayofweek(due_date) NOT IN (1, 7) AND due_date_observed <> due_date
         AND NOT (month(due_date) = 1 AND dayofweek(due_date) = 2 AND day(due_date) BETWEEN 15 AND 21))
UNION ALL SELECT 'filing_timing days_late null only when posted_date null', count(*) FROM gold.filing_timing
  WHERE (days_late IS NULL) <> (posted_date IS NULL)
     OR (posted_date IS NOT NULL AND (days_late <> datediff(posted_date, due_date_observed) OR posted_weekday IS NULL OR posted_hour_utc IS NULL))
UNION ALL SELECT 'filing_timing posted_weekday accepted values', count(*) FROM gold.filing_timing
  WHERE posted_weekday NOT IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
UNION ALL SELECT 'filing_timing posted_hour_utc is 0..23', count(*) FROM gold.filing_timing WHERE posted_hour_utc < 0 OR posted_hour_utc > 23
UNION ALL SELECT 'peer_rank kind accepted values', count(*) FROM gold.peer_rank WHERE kind NOT IN ('firm', 'client')
UNION ALL SELECT 'peer_rank pct_rank is 0..1', count(*) FROM gold.peer_rank WHERE pct_rank < 0 OR pct_rank > 1
UNION ALL SELECT 'peer_rank highest income in an issue code has pct_rank 1 (unless tied)', count(*) FROM (
  SELECT kind, issue_code, count(*) AS peers, max_by(pct_rank, income) AS top_rank,
         sum(CASE WHEN income = top_income THEN 1 ELSE 0 END) AS rows_at_top
  FROM (SELECT kind, issue_code, income, pct_rank, max(income) OVER (PARTITION BY kind, issue_code) AS top_income FROM gold.peer_rank)
  GROUP BY kind, issue_code) x
  WHERE peers > 1 AND rows_at_top = 1 AND top_rank <> 1
UNION ALL SELECT 'peer_rank lowest income in an issue code has pct_rank 0', count(*) FROM (
  SELECT kind, issue_code, min_by(pct_rank, income) AS bottom_rank FROM gold.peer_rank GROUP BY kind, issue_code) x
  WHERE bottom_rank <> 0
UNION ALL SELECT 'edge kinds accepted values', count(*) FROM gold.edge
  WHERE (src_kind, dst_kind) NOT IN (('client', 'firm'), ('engagement', 'bill'), ('lobbyist', 'engagement'))
UNION ALL SELECT 'edge weight is not negative', count(*) FROM gold.edge WHERE weight < 0

-- Gold: income rules. Null income on a report means 0 (rule 5), so no
-- mart may carry a null income or total.
UNION ALL SELECT 'no null income in engagement_quarter', count(*) FROM gold.engagement_quarter WHERE income IS NULL
UNION ALL SELECT 'no null income in topic_quarter', count(*) FROM gold.topic_quarter WHERE income IS NULL
UNION ALL SELECT 'no null income in client_quarter', count(*) FROM gold.client_quarter WHERE income IS NULL
UNION ALL SELECT 'no null income in firm_quarter', count(*) FROM gold.firm_quarter WHERE income IS NULL
UNION ALL SELECT 'no null total_income in engagement', count(*) FROM gold.engagement WHERE total_income IS NULL
UNION ALL SELECT 'no null total_income in topic', count(*) FROM gold.topic WHERE total_income IS NULL
UNION ALL SELECT 'no null total_income in client', count(*) FROM gold.client WHERE total_income IS NULL
UNION ALL SELECT 'no null total_income in firm', count(*) FROM gold.firm WHERE total_income IS NULL
UNION ALL SELECT 'no null income_while_listed in lobbyist_engagement', count(*) FROM gold.lobbyist_engagement WHERE income_while_listed IS NULL
UNION ALL SELECT 'no null income in term_quarter', count(*) FROM gold.term_quarter WHERE income IS NULL
UNION ALL SELECT 'no null income in term', count(*) FROM gold.term WHERE income IS NULL
UNION ALL SELECT 'no null income in government_entity_quarter', count(*) FROM gold.government_entity_quarter WHERE income IS NULL
UNION ALL SELECT 'no null income in government_entity', count(*) FROM gold.government_entity WHERE income IS NULL
UNION ALL SELECT 'no null income in foreign_country_quarter', count(*) FROM gold.foreign_country_quarter WHERE income IS NULL
UNION ALL SELECT 'no null income in bill_quarter', count(*) FROM gold.bill_quarter WHERE income IS NULL
UNION ALL SELECT 'no null income in bill_congress', count(*) FROM gold.bill_congress WHERE income IS NULL
UNION ALL SELECT 'no null income in revolving_door', count(*) FROM gold.revolving_door WHERE income IS NULL
UNION ALL SELECT 'no null income in organization_quarter', count(*) FROM gold.organization_quarter WHERE income IS NULL
UNION ALL SELECT 'no null total_income in organization', count(*) FROM gold.organization WHERE total_income IS NULL
UNION ALL SELECT 'no null total_income in organization_firm', count(*) FROM gold.organization_firm WHERE total_income IS NULL
UNION ALL SELECT 'no null income in surge', count(*) FROM gold.surge WHERE income IS NULL
UNION ALL SELECT 'no null income in peer_rank', count(*) FROM gold.peer_rank WHERE income IS NULL
UNION ALL SELECT 'engagement total_income equals the sum of its quarters', count(*) FROM gold.engagement g
  WHERE g.total_income <> (SELECT coalesce(sum(q.income), 0) FROM gold.engagement_quarter q WHERE q.engagement_hk = g.engagement_hk)

-- Gold: a quarterly report with no income still produces a topic row with 0,
-- so a topic page with filings but no income renders a $0 chart.
UNION ALL SELECT 'topic_quarter keeps zero-income quarters', count(*) FROM (
  SELECT DISTINCT x.issue_code, q.period_end_date
  FROM gold.engagement_quarter q
  LATERAL VIEW explode(split(q.issue_codes, ', ')) x AS issue_code
  WHERE q.issue_codes IS NOT NULL AND q.income = 0) z
  WHERE NOT EXISTS (SELECT 1 FROM gold.topic_quarter t
                    WHERE t.issue_code = z.issue_code AND t.period_end_date = z.period_end_date)

-- Gold: the latest quarterly report governs the status. The source allows
-- reports after a termination without a new registration; proof.sql counts
-- them as an observation. The assertion here is the rule Gold applies.
UNION ALL SELECT 'engagement whose latest report is a termination is lapsed', count(*) FROM gold.engagement g
  JOIN (SELECT engagement_hk, max_by(is_termination, struct(period_end_date, dt_posted)) AS last_is_termination
        FROM gold.fact_filing GROUP BY engagement_hk) f ON f.engagement_hk = g.engagement_hk
  WHERE f.last_is_termination AND g.engagement_status <> 'lapsed'

-- Access: the two app principals (sql/grants.sql) read Gold only. One
-- statement cannot run as another principal, so the denied read is
-- proven by its grants: neither principal holds a grant on the Silver
-- schema, on any Silver table, or a catalog-wide SELECT that would reach
-- Silver. Unity Catalog lists a service principal by its application id.
UNION ALL SELECT 'silver is granted to no app principal (lobby-public reads Gold only)',
  (SELECT count(*) FROM system.information_schema.schema_privileges
   WHERE catalog_name = 'workspace' AND schema_name = 'silver'
     AND grantee IN ('3d0ab98e-1abe-4621-a845-9807d00403cc', '859d1473-c864-4903-8164-e7740612cea3'))
  + (SELECT count(*) FROM system.information_schema.table_privileges
     WHERE table_catalog = 'workspace' AND table_schema = 'silver'
       AND grantee IN ('3d0ab98e-1abe-4621-a845-9807d00403cc', '859d1473-c864-4903-8164-e7740612cea3'))
  + (SELECT count(*) FROM system.information_schema.catalog_privileges
     WHERE catalog_name = 'workspace' AND privilege_type IN ('SELECT', 'ALL_PRIVILEGES', 'ALL PRIVILEGES')
       AND grantee IN ('3d0ab98e-1abe-4621-a845-9807d00403cc', '859d1473-c864-4903-8164-e7740612cea3'))

) t
GROUP BY ROLLUP(t.test)
ORDER BY grouping(t.test) DESC, failing_assertions DESC, t.test;
