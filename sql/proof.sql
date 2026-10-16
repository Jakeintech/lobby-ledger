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
UNION ALL SELECT 'hub_organization', count(*) FROM silver.hub_organization
UNION ALL SELECT 'link_client_organization', count(*) FROM silver.link_client_organization
UNION ALL SELECT 'hub_issue', count(*) FROM silver.hub_issue
UNION ALL SELECT 'hub_government_entity', count(*) FROM silver.hub_government_entity
UNION ALL SELECT 'link_engagement', count(*) FROM silver.link_engagement
UNION ALL SELECT 'link_engagement_lobbyist', count(*) FROM silver.link_engagement_lobbyist
UNION ALL SELECT 'link_engagement_issue', count(*) FROM silver.link_engagement_issue
UNION ALL SELECT 'link_engagement_government_entity', count(*) FROM silver.link_engagement_government_entity
UNION ALL SELECT 'sat_engagement_filing', count(*) FROM silver.sat_engagement_filing
UNION ALL SELECT 'sat_engagement_issues_text', count(*) FROM silver.sat_engagement_issues_text
UNION ALL SELECT 'sat_engagement_lobbyist_filing', count(*) FROM silver.sat_engagement_lobbyist_filing
UNION ALL SELECT 'sat_client_ppb', count(*) FROM silver.sat_client_ppb
UNION ALL SELECT 'sat_engagement_government_entity_filing', count(*) FROM silver.sat_engagement_government_entity_filing
UNION ALL SELECT 'hub_foreign_entity', count(*) FROM silver.hub_foreign_entity
UNION ALL SELECT 'link_engagement_foreign_entity', count(*) FROM silver.link_engagement_foreign_entity
UNION ALL SELECT 'sat_foreign_entity_filing', count(*) FROM silver.sat_foreign_entity_filing
UNION ALL SELECT 'hub_affiliated_organization', count(*) FROM silver.hub_affiliated_organization
UNION ALL SELECT 'link_engagement_affiliated_organization', count(*) FROM silver.link_engagement_affiliated_organization
UNION ALL SELECT 'sat_affiliated_organization_filing', count(*) FROM silver.sat_affiliated_organization_filing
UNION ALL SELECT 'hub_legislator', count(*) FROM silver.hub_legislator
UNION ALL SELECT 'sat_legislator_profile', count(*) FROM silver.sat_legislator_profile
UNION ALL SELECT 'hub_committee', count(*) FROM silver.hub_committee
UNION ALL SELECT 'sat_committee_profile', count(*) FROM silver.sat_committee_profile
UNION ALL SELECT 'hub_bill', count(*) FROM silver.hub_bill
UNION ALL SELECT 'sat_bill_detail', count(*) FROM silver.sat_bill_detail
UNION ALL SELECT 'sat_bill_action', count(*) FROM silver.sat_bill_action;

-- 4. Gold row counts, one line per mart.
SELECT 'fact_filing' AS object, count(*) AS row_count FROM gold.fact_filing
UNION ALL SELECT 'engagement_quarter', count(*) FROM gold.engagement_quarter
UNION ALL SELECT 'engagement', count(*) FROM gold.engagement
UNION ALL SELECT 'engagement_bill', count(*) FROM gold.engagement_bill
UNION ALL SELECT 'engagement_ai_summary', count(*) FROM gold.engagement_ai_summary
UNION ALL SELECT 'filing_bill', count(*) FROM gold.filing_bill
UNION ALL SELECT 'bill_alias', count(*) FROM gold.bill_alias
UNION ALL SELECT 'filing_bill_alias', count(*) FROM gold.filing_bill_alias
UNION ALL SELECT 'topic', count(*) FROM gold.topic
UNION ALL SELECT 'topic_quarter', count(*) FROM gold.topic_quarter
UNION ALL SELECT 'topic_client', count(*) FROM gold.topic_client
UNION ALL SELECT 'topic_firm', count(*) FROM gold.topic_firm
UNION ALL SELECT 'topic_bill', count(*) FROM gold.topic_bill
UNION ALL SELECT 'bill_mention', count(*) FROM gold.bill_mention
UNION ALL SELECT 'bill_congress', count(*) FROM gold.bill_congress
UNION ALL SELECT 'bill_detail', count(*) FROM gold.bill_detail
UNION ALL SELECT 'bill_milestone', count(*) FROM gold.bill_milestone
UNION ALL SELECT 'bill_quarter', count(*) FROM gold.bill_quarter
UNION ALL SELECT 'bill_engagement', count(*) FROM gold.bill_engagement
UNION ALL SELECT 'bill_milestone_window', count(*) FROM gold.bill_milestone_window
UNION ALL SELECT 'client', count(*) FROM gold.client
UNION ALL SELECT 'client_quarter', count(*) FROM gold.client_quarter
UNION ALL SELECT 'firm', count(*) FROM gold.firm
UNION ALL SELECT 'firm_quarter', count(*) FROM gold.firm_quarter
UNION ALL SELECT 'lobbyist', count(*) FROM gold.lobbyist
UNION ALL SELECT 'lobbyist_engagement', count(*) FROM gold.lobbyist_engagement
UNION ALL SELECT 'search_entity', count(*) FROM gold.search_entity
UNION ALL SELECT 'issue_name', count(*) FROM gold.issue_name
UNION ALL SELECT 'activity_text', count(*) FROM gold.activity_text
UNION ALL SELECT 'curated_term', count(*) FROM gold.curated_term
UNION ALL SELECT 'term_hit', count(*) FROM gold.term_hit
UNION ALL SELECT 'term', count(*) FROM gold.term
UNION ALL SELECT 'term_quarter', count(*) FROM gold.term_quarter
UNION ALL SELECT 'term_client', count(*) FROM gold.term_client
UNION ALL SELECT 'term_issue', count(*) FROM gold.term_issue
UNION ALL SELECT 'government_entity_contact', count(*) FROM gold.government_entity_contact
UNION ALL SELECT 'government_entity', count(*) FROM gold.government_entity
UNION ALL SELECT 'government_entity_quarter', count(*) FROM gold.government_entity_quarter
UNION ALL SELECT 'government_entity_issue', count(*) FROM gold.government_entity_issue
UNION ALL SELECT 'government_entity_client', count(*) FROM gold.government_entity_client
UNION ALL SELECT 'foreign_filing', count(*) FROM gold.foreign_filing
UNION ALL SELECT 'foreign_country', count(*) FROM gold.foreign_country
UNION ALL SELECT 'foreign_country_quarter', count(*) FROM gold.foreign_country_quarter
UNION ALL SELECT 'foreign_country_client', count(*) FROM gold.foreign_country_client
UNION ALL SELECT 'lobbyist_position', count(*) FROM gold.lobbyist_position
UNION ALL SELECT 'lobbyist_affiliation', count(*) FROM gold.lobbyist_affiliation
UNION ALL SELECT 'revolving_door', count(*) FROM gold.revolving_door
UNION ALL SELECT 'organization', count(*) FROM gold.organization
UNION ALL SELECT 'organization_quarter', count(*) FROM gold.organization_quarter
UNION ALL SELECT 'organization_firm', count(*) FROM gold.organization_firm
UNION ALL SELECT 'issue_committee', count(*) FROM gold.issue_committee
UNION ALL SELECT 'surge', count(*) FROM gold.surge
UNION ALL SELECT 'filing_timing', count(*) FROM gold.filing_timing
UNION ALL SELECT 'peer_rank', count(*) FROM gold.peer_rank
UNION ALL SELECT 'edge', count(*) FROM gold.edge;

-- 5. The income attribution rule in one line: the sum over topics is larger
--    than the sum over engagements because a filing counts toward every
--    issue code it lists.
SELECT (SELECT sum(total_income) FROM gold.topic) AS income_summed_over_topics,
       (SELECT sum(total_income) FROM gold.engagement) AS income_summed_over_engagements;

-- 6. Status split and the newest quarter in the data.
SELECT engagement_status, count(*) AS engagements, max(last_period) AS newest_period
FROM gold.engagement GROUP BY engagement_status;

-- 7. The addendum marts at a glance: which have rows on this data slice.
SELECT 'term' AS mart, count(*) > 0 AS populated FROM gold.term
UNION ALL SELECT 'government_entity', count(*) > 0 FROM gold.government_entity
UNION ALL SELECT 'lobbyist_affiliation', count(*) > 0 FROM gold.lobbyist_affiliation
UNION ALL SELECT 'revolving_door', count(*) > 0 FROM gold.revolving_door
UNION ALL SELECT 'foreign_country', count(*) > 0 FROM gold.foreign_country
UNION ALL SELECT 'bill_congress', count(*) > 0 FROM gold.bill_congress
UNION ALL SELECT 'bill_detail', count(*) > 0 FROM gold.bill_detail
UNION ALL SELECT 'bill_milestone', count(*) > 0 FROM gold.bill_milestone
UNION ALL SELECT 'bill_alias', count(*) > 0 FROM gold.bill_alias
UNION ALL SELECT 'bill_milestone_window', count(*) > 0 FROM gold.bill_milestone_window;

-- 8. Revolving door by confidence, as disclosed by the lobbyist.
SELECT kind, confidence, count(*) AS affiliations, count(DISTINCT lobbyist_id) AS lobbyists
FROM gold.lobbyist_affiliation GROUP BY kind, confidence ORDER BY kind, confidence;

-- 9. The agencies most often named in covered positions. Empty until
--    government_entities.csv lands; once it does, a chamber or a catch-all
--    name at the top means the agency matcher needs a narrower rule.
SELECT ref_name, count(DISTINCT lobbyist_id) AS lobbyists
FROM gold.lobbyist_affiliation WHERE kind = 'agency'
GROUP BY ref_name ORDER BY lobbyists DESC, ref_name LIMIT 10;

-- 10. Curated terms with no mention on this slice still carry a term row
--     with zeros, so every tile on /trends renders.
SELECT count(*) AS curated_terms, sum(CASE WHEN filings_mentioning = 0 THEN 1 ELSE 0 END) AS terms_without_mentions
FROM gold.term;

-- 12. Organizations across firms: how many organizations stand behind more
--     than one client record, and the five registered with the most firms.
SELECT count(*) AS organizations,
       sum(CASE WHEN client_count > 1 THEN 1 ELSE 0 END) AS organizations_with_several_client_rows,
       sum(CASE WHEN firm_count > 1 THEN 1 ELSE 0 END) AS organizations_with_several_firms
FROM gold.organization;

SELECT organization_name, client_count, firm_count, total_income
FROM gold.organization ORDER BY firm_count DESC, total_income DESC, organization_name LIMIT 5;

-- 13. Committee jurisdiction: codes mapped per chamber, and how many
--     revolving-door rows have a committee with jurisdiction over the
--     engagement's issues.
SELECT chamber, count(DISTINCT issue_code) AS issue_codes, count(DISTINCT thomas_id) AS committees
FROM gold.issue_committee GROUP BY chamber ORDER BY chamber;

SELECT jurisdiction_match, lobbies_former_employer, count(*) AS rows
FROM gold.revolving_door GROUP BY 1, 2 ORDER BY 1, 2;

-- 14. Surges by kind, and the newest quarter's surges.
SELECT kind, count(*) AS scored_quarters, sum(CASE WHEN is_surge THEN 1 ELSE 0 END) AS surges
FROM gold.surge GROUP BY kind ORDER BY kind;

SELECT kind, name, period_end_date, income, mean_prior, z
FROM gold.surge WHERE is_surge AND period_end_date = (SELECT max(period_end_date) FROM gold.surge)
ORDER BY z DESC, kind, id LIMIT 5;

-- 15. Filing timing: the share of reports posted after the observed due
--     date, by period, so the weekend and holiday shift of the deadline
--     is visible, then the posting weekdays.
SELECT period_end_date, due_date, due_date_observed, count(*) AS reports,
       sum(CASE WHEN days_late > 0 THEN 1 ELSE 0 END) AS late,
       round(100 * avg(CASE WHEN days_late > 0 THEN 1.0 ELSE 0 END), 1) AS pct_late,
       percentile_approx(days_late, 0.5) AS median_days_late,
       sum(CASE WHEN posted_date = due_date_observed THEN 1 ELSE 0 END) AS posted_on_due_day
FROM gold.filing_timing GROUP BY 1, 2, 3 ORDER BY 1;

SELECT count(*) AS reports, sum(CASE WHEN days_late > 0 THEN 1 ELSE 0 END) AS late,
       round(100 * avg(CASE WHEN days_late > 0 THEN 1.0 ELSE 0 END), 1) AS pct_late,
       percentile_approx(days_late, 0.5) AS median_days_late
FROM gold.filing_timing;

SELECT posted_weekday, count(*) AS reports FROM gold.filing_timing GROUP BY posted_weekday ORDER BY reports DESC;

-- 16. Network edges by kind.
SELECT src_kind, dst_kind, count(*) AS edges, sum(weight) AS total_weight
FROM gold.edge GROUP BY src_kind, dst_kind ORDER BY src_kind;

-- Manual step, not run here: a denied read of Silver as lobby-public.
--   databricks -p <lobby-public profile> api post /api/2.0/sql/statements \
--     --json '{"statement": "SELECT 1 FROM workspace.silver.hub_client LIMIT 1", "warehouse_id": "..."}'
-- The expected result is a PERMISSION_DENIED error.

-- 11. Source behaviour, observed not asserted: engagements that filed a
--     quarterly report after a termination without a new registration.
--     Gold keeps those reports and lets the latest one govern the status.
SELECT count(DISTINCT q.engagement_hk) AS engagements_reporting_after_termination
FROM gold.engagement_quarter q
JOIN gold.fact_filing t ON t.engagement_hk = q.engagement_hk AND t.is_termination
WHERE date_trunc('QUARTER', q.period_end_date) > date_trunc('QUARTER', t.period_end_date)
  AND NOT EXISTS (SELECT 1 FROM silver.sat_engagement_filing r
                  WHERE r.engagement_hk = q.engagement_hk AND r.filing_type IN ('RR', 'RA') AND r.dt_posted > t.dt_posted);

-- 17. Popular-name aliases: how many names, how many bills carry one,
--     and how many filings they reach. Title aliases are empty until the
--     Congress.gov pull lands; the curated rows are there from the start.
SELECT count(*) AS aliases, count(DISTINCT congress, bill_key) AS bills_with_alias,
       sum(CASE WHEN alias RLIKE ' act( of 20[0-9]{2})?$' THEN 1 ELSE 0 END) AS aliases_ending_in_act
FROM gold.bill_alias;

SELECT count(*) AS alias_hits, count(DISTINCT filing_uuid) AS filings_matched_by_alias,
       count(DISTINCT congress_bill) AS bills_matched_by_alias
FROM (SELECT filing_uuid, concat(bill_key, '|', alias) AS congress_bill FROM gold.filing_bill_alias);

SELECT alias, bill_key, count(DISTINCT filing_uuid) AS filings
FROM gold.filing_bill_alias GROUP BY alias, bill_key ORDER BY filings DESC LIMIT 10;

-- 18. Lobbying before milestones: windows per milestone and what fell in
--     them. Empty until the Congress.gov pull lands.
SELECT milestone, count(*) AS windows, sum(filings_90d_before) AS filings,
       sum(income_90d_before) AS income, max(clients_90d_before) AS most_clients
FROM gold.bill_milestone_window GROUP BY milestone ORDER BY milestone;
