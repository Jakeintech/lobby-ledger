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
UNION ALL SELECT 'filing_type matches LDA code pattern', count(*) FROM silver.sat_engagement_filing
  WHERE filing_type NOT RLIKE '^(RR|RA|Q[1-4][AY]?|[1-4](A|T|TA|TY)|MM|MA|YY|YA)$'
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
UNION ALL SELECT 'bill unique key', count(*) - count(DISTINCT bill_key) FROM gold.bill
UNION ALL SELECT 'bill not_null key', count(*) FROM gold.bill WHERE bill_key IS NULL
UNION ALL SELECT 'bill_quarter unique key', count(*) - count(DISTINCT bill_key, period_end_date) FROM gold.bill_quarter
UNION ALL SELECT 'bill_quarter not_null key', count(*) FROM gold.bill_quarter WHERE bill_key IS NULL OR period_end_date IS NULL
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
UNION ALL SELECT 'topic_bill -> bill', count(*) FROM gold.topic_bill b
  WHERE NOT EXISTS (SELECT 1 FROM gold.bill x WHERE x.bill_key = b.bill_key)
UNION ALL SELECT 'bill_quarter -> bill', count(*) FROM gold.bill_quarter q
  WHERE NOT EXISTS (SELECT 1 FROM gold.bill b WHERE b.bill_key = q.bill_key)
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

-- Gold: accepted values and formats
UNION ALL SELECT 'engagement_status accepted values', count(*) FROM gold.engagement
  WHERE engagement_status NOT IN ('active','lapsed')
UNION ALL SELECT 'search_entity kind accepted values', count(*) FROM gold.search_entity
  WHERE kind NOT IN ('client','firm')
UNION ALL SELECT 'bill_key matches the bill pattern', count(*) FROM gold.bill
  WHERE bill_key NOT RLIKE '^(HR|S|HJRES|SJRES|HCONRES|SCONRES|HRES|SRES)[0-9]{1,5}$'
UNION ALL SELECT 'engagement_bill key matches the bill pattern', count(*) FROM gold.engagement_bill
  WHERE bill_key NOT RLIKE '^(HR|S|HJRES|SJRES|HCONRES|SCONRES|HRES|SRES)[0-9]{1,5}$'
UNION ALL SELECT 'engagement_bill labels not_null', count(*) FROM gold.engagement_bill WHERE bill_label IS NULL
UNION ALL SELECT 'topic rank is 1..n', count(*) - count(DISTINCT rank)
  + sum(CASE WHEN rank < 1 THEN 1 ELSE 0 END) + greatest(max(rank) - count(*), 0) FROM gold.topic
UNION ALL SELECT 'engagement not_null names', count(*) FROM gold.engagement
  WHERE client IS NULL OR firm IS NULL OR client_id IS NULL OR registrant_id IS NULL

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

-- Gold: no quarter row after a termination, unless the engagement registered
-- again after that termination (RR or RA posted later) and so resumed.
-- This is an expectation about the filings themselves, not a rule applied
-- in lakehouse.sql: the LDA requires a new registration before a firm
-- reports for a client again, and Gold keeps every quarterly report it is
-- given. A failure here means the source holds a report posted after a
-- termination with no registration in between; treat it as real history
-- or add a rule to engagement_quarter that drops such reports, and say so.
UNION ALL SELECT 'no engagement_quarter row after termination_date', count(*) FROM gold.engagement_quarter q
  JOIN gold.fact_filing t ON t.engagement_hk = q.engagement_hk AND t.is_termination
  JOIN (SELECT filing_uuid, max(termination_date) AS termination_date
        FROM silver.sat_engagement_filing WHERE termination_date IS NOT NULL GROUP BY filing_uuid) ts
    ON ts.filing_uuid = t.filing_uuid
  WHERE date_trunc('QUARTER', q.period_end_date) > date_trunc('QUARTER', ts.termination_date)
    AND NOT EXISTS (SELECT 1 FROM silver.sat_engagement_filing r
                    WHERE r.engagement_hk = q.engagement_hk AND r.filing_type IN ('RR', 'RA')
                      AND r.dt_posted > t.dt_posted)
UNION ALL SELECT 'terminated engagement without a later registration is lapsed', count(*) FROM gold.engagement g
  WHERE g.engagement_status = 'active'
    AND EXISTS (SELECT 1 FROM gold.fact_filing t WHERE t.engagement_hk = g.engagement_hk AND t.is_termination)
    AND NOT EXISTS (SELECT 1 FROM gold.fact_filing t
                    JOIN silver.sat_engagement_filing r ON r.engagement_hk = t.engagement_hk
                    WHERE t.engagement_hk = g.engagement_hk AND t.is_termination
                      AND r.filing_type IN ('RR', 'RA') AND r.dt_posted > t.dt_posted)

) t
GROUP BY ROLLUP(t.test)
ORDER BY grouping(t.test) DESC, failing_assertions DESC, t.test;
