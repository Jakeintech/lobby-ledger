-- lakehouse.sql
-- Builds the Silver Raw Vault and the Gold marts (one per page) from Bronze.
-- Idempotent: safe to run again. Hubs, links and satellites only insert rows
-- they have not seen; Gold is rebuilt from Silver on every run.
-- Run with: python3 sql/run_sql.py sql/lakehouse.sql
--
-- Hard rules (Silver): cast, trim, upper, md5, dedupe. No business meaning.
-- Soft rules (Gold): status, totals, as-of logic, anything a business user
-- could argue about.

CREATE SCHEMA IF NOT EXISTS silver;
CREATE SCHEMA IF NOT EXISTS gold;

-- =====================================================================
-- SILVER: RAW VAULT
-- =====================================================================

-- hub_registrant: one row per lobbying firm ever seen (the "firm").
-- Business key is the LDA registrant id. The hash key is md5 of the
-- normalized business key so every layer can join without lookups.
CREATE TABLE IF NOT EXISTS silver.hub_registrant (
  registrant_hk STRING, registrant_bk STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.hub_registrant
SELECT DISTINCT md5(upper(trim(CAST(registrant_id AS STRING)))), upper(trim(CAST(registrant_id AS STRING))),
       current_timestamp(), 'lda.senate.gov'
FROM bronze.lda_registrants s
WHERE NOT EXISTS (SELECT 1 FROM silver.hub_registrant h
                  WHERE h.registrant_hk = md5(upper(trim(CAST(s.registrant_id AS STRING)))));

-- hub_client: one row per client of a lobbying firm.
CREATE TABLE IF NOT EXISTS silver.hub_client (
  client_hk STRING, client_bk STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.hub_client
SELECT DISTINCT md5(upper(trim(CAST(client_id AS STRING)))), upper(trim(CAST(client_id AS STRING))),
       current_timestamp(), 'lda.senate.gov'
FROM bronze.lda_clients s
WHERE NOT EXISTS (SELECT 1 FROM silver.hub_client h
                  WHERE h.client_hk = md5(upper(trim(CAST(s.client_id AS STRING)))));

-- hub_lobbyist: one row per individual lobbyist named on a filing.
CREATE TABLE IF NOT EXISTS silver.hub_lobbyist (
  lobbyist_hk STRING, lobbyist_bk STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.hub_lobbyist
SELECT DISTINCT md5(upper(trim(CAST(lobbyist_id AS STRING)))), upper(trim(CAST(lobbyist_id AS STRING))),
       current_timestamp(), 'lda.senate.gov'
FROM bronze.lda_lobbyists s
WHERE NOT EXISTS (SELECT 1 FROM silver.hub_lobbyist h
                  WHERE h.lobbyist_hk = md5(upper(trim(CAST(s.lobbyist_id AS STRING)))));

-- hub_issue: one row per LDA general issue code (TAX, HCR, EDU ...).
CREATE TABLE IF NOT EXISTS silver.hub_issue (
  issue_hk STRING, issue_bk STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.hub_issue
SELECT DISTINCT md5(upper(trim(general_issue_code))), upper(trim(general_issue_code)),
       current_timestamp(), 'lda.senate.gov'
FROM bronze.lda_lobbying_activities s
WHERE NOT EXISTS (SELECT 1 FROM silver.hub_issue h
                  WHERE h.issue_hk = md5(upper(trim(s.general_issue_code))));

-- link_engagement: a registrant (lobbying firm) working for a client.
-- The hash key is derived from both business keys, so every quarterly
-- filing for the same pair resolves to the same engagement_hk.
CREATE TABLE IF NOT EXISTS silver.link_engagement (
  engagement_hk STRING, registrant_hk STRING, client_hk STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.link_engagement
SELECT DISTINCT
  md5(concat_ws('||', upper(trim(CAST(registrant_id AS STRING))), upper(trim(CAST(client_id AS STRING))))),
  md5(upper(trim(CAST(registrant_id AS STRING)))),
  md5(upper(trim(CAST(client_id AS STRING)))),
  current_timestamp(), 'lda.senate.gov'
FROM bronze.lda_filings s
WHERE NOT EXISTS (SELECT 1 FROM silver.link_engagement l WHERE l.engagement_hk =
  md5(concat_ws('||', upper(trim(CAST(s.registrant_id AS STRING))), upper(trim(CAST(s.client_id AS STRING))))));

-- Staging view used by the remaining links and satellites: every filing
-- with its engagement hash key already computed (hard rules only).
CREATE OR REPLACE VIEW silver.v_filing_keys AS
SELECT
  trim(filing_uuid) AS filing_uuid,
  md5(concat_ws('||', upper(trim(CAST(registrant_id AS STRING))), upper(trim(CAST(client_id AS STRING))))) AS engagement_hk,
  upper(trim(filing_type)) AS filing_type,
  CAST(filing_year AS INT) AS filing_year,
  lower(trim(filing_period)) AS filing_period,
  CAST(income AS DECIMAL(14,2)) AS income,
  CAST(expenses AS DECIMAL(14,2)) AS expenses,
  CAST(termination_date AS DATE) AS termination_date,
  CAST(dt_posted AS TIMESTAMP) AS dt_posted
FROM bronze.lda_filings;

-- link_engagement_lobbyist: which lobbyists have ever worked an engagement.
CREATE TABLE IF NOT EXISTS silver.link_engagement_lobbyist (
  engagement_lobbyist_hk STRING, engagement_hk STRING, lobbyist_hk STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.link_engagement_lobbyist
SELECT DISTINCT md5(concat_ws('||', f.engagement_hk, upper(trim(CAST(l.lobbyist_id AS STRING))))),
       f.engagement_hk, md5(upper(trim(CAST(l.lobbyist_id AS STRING)))), current_timestamp(), 'lda.senate.gov'
FROM bronze.lda_lobbyists l JOIN silver.v_filing_keys f ON f.filing_uuid = trim(l.filing_uuid)
WHERE NOT EXISTS (SELECT 1 FROM silver.link_engagement_lobbyist x WHERE x.engagement_lobbyist_hk =
  md5(concat_ws('||', f.engagement_hk, upper(trim(CAST(l.lobbyist_id AS STRING))))));

-- link_engagement_issue: which issue codes an engagement has covered.
CREATE TABLE IF NOT EXISTS silver.link_engagement_issue (
  engagement_issue_hk STRING, engagement_hk STRING, issue_hk STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.link_engagement_issue
SELECT DISTINCT md5(concat_ws('||', f.engagement_hk, upper(trim(a.general_issue_code)))),
       f.engagement_hk, md5(upper(trim(a.general_issue_code))), current_timestamp(), 'lda.senate.gov'
FROM bronze.lda_lobbying_activities a JOIN silver.v_filing_keys f ON f.filing_uuid = trim(a.filing_uuid)
WHERE NOT EXISTS (SELECT 1 FROM silver.link_engagement_issue x WHERE x.engagement_issue_hk =
  md5(concat_ws('||', f.engagement_hk, upper(trim(a.general_issue_code)))));

-- hub_government_entity: one row per federal agency or chamber a filing
-- says was contacted (House of Representatives, Dept of the Treasury ...).
-- The LDA gives these an id, but the name is the stable business key.
CREATE TABLE IF NOT EXISTS silver.hub_government_entity (
  entity_hk STRING, entity_bk STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.hub_government_entity
SELECT DISTINCT md5(upper(trim(entity_name))), upper(trim(entity_name)), current_timestamp(), 'lda.senate.gov'
FROM bronze.lda_government_entities s
WHERE entity_name IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM silver.hub_government_entity h WHERE h.entity_hk = md5(upper(trim(s.entity_name))));

-- link_engagement_government_entity: which government entities an
-- engagement has contacted, and under which issue code.
CREATE TABLE IF NOT EXISTS silver.link_engagement_government_entity (
  engagement_entity_hk STRING, engagement_hk STRING, entity_hk STRING, issue_code STRING,
  load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.link_engagement_government_entity
SELECT DISTINCT md5(concat_ws('||', f.engagement_hk, md5(upper(trim(g.entity_name))), upper(trim(g.general_issue_code)))),
       f.engagement_hk, md5(upper(trim(g.entity_name))), upper(trim(g.general_issue_code)), current_timestamp(), 'lda.senate.gov'
FROM bronze.lda_government_entities g JOIN silver.v_filing_keys f ON f.filing_uuid = trim(g.filing_uuid)
WHERE g.entity_name IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM silver.link_engagement_government_entity x WHERE x.engagement_entity_hk =
    md5(concat_ws('||', f.engagement_hk, md5(upper(trim(g.entity_name))), upper(trim(g.general_issue_code)))));

-- sat_engagement_filing: one row per quarterly filing of an engagement.
-- This is the type-2 history of the engagement: income, filing type and
-- termination change over time. hash_diff is md5 of the descriptive
-- columns; an identical filing reloaded later produces the same hash_diff
-- and is skipped, so reruns never create duplicate history.
CREATE TABLE IF NOT EXISTS silver.sat_engagement_filing (
  engagement_hk STRING, filing_uuid STRING, hash_diff STRING, filing_type STRING, filing_year INT,
  filing_period STRING, income DECIMAL(14,2), expenses DECIMAL(14,2), termination_date DATE,
  dt_posted TIMESTAMP, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.sat_engagement_filing
SELECT engagement_hk, filing_uuid, hash_diff, filing_type, filing_year, filing_period, income, expenses,
       termination_date, dt_posted, current_timestamp(), 'lda.senate.gov'
FROM (
  SELECT DISTINCT *, md5(concat_ws('||', filing_type, CAST(filing_year AS STRING), filing_period,
         coalesce(CAST(income AS STRING), ''), coalesce(CAST(expenses AS STRING), ''),
         coalesce(CAST(termination_date AS STRING), ''))) AS hash_diff
  FROM silver.v_filing_keys) s
WHERE NOT EXISTS (SELECT 1 FROM silver.sat_engagement_filing t
                  WHERE t.filing_uuid = s.filing_uuid AND t.hash_diff = s.hash_diff);

-- sat_engagement_issues_text: the free-text "specific issues" per filing
-- and issue code. This is the text the AI summary reads.
CREATE TABLE IF NOT EXISTS silver.sat_engagement_issues_text (
  engagement_hk STRING, filing_uuid STRING, issue_code STRING, hash_diff STRING,
  specific_issues STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.sat_engagement_issues_text
SELECT engagement_hk, filing_uuid, issue_code, hash_diff, specific_issues, current_timestamp(), 'lda.senate.gov'
FROM (
  SELECT DISTINCT f.engagement_hk, f.filing_uuid, upper(trim(a.general_issue_code)) AS issue_code,
         trim(a.specific_issues) AS specific_issues, md5(coalesce(trim(a.specific_issues), '')) AS hash_diff
  FROM bronze.lda_lobbying_activities a JOIN silver.v_filing_keys f ON f.filing_uuid = trim(a.filing_uuid)) s
WHERE NOT EXISTS (SELECT 1 FROM silver.sat_engagement_issues_text t
                  WHERE t.filing_uuid = s.filing_uuid AND t.issue_code = s.issue_code AND t.hash_diff = s.hash_diff);

-- sat_engagement_lobbyist_filing: effectivity satellite saying which
-- lobbyist was listed on which filing. Lets Gold rebuild the team as of
-- any quarter. Bronze has one lobbyist row per filing, issue and person,
-- and the covered position can be filled on one issue row and empty on
-- another, so the source is collapsed to one row per filing and person
-- (dedupe is a hard rule) before the guard.
CREATE TABLE IF NOT EXISTS silver.sat_engagement_lobbyist_filing (
  engagement_lobbyist_hk STRING, filing_uuid STRING, covered_position STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.sat_engagement_lobbyist_filing
SELECT s.engagement_lobbyist_hk, s.filing_uuid, s.covered_position, current_timestamp(), 'lda.senate.gov'
FROM (
  SELECT md5(concat_ws('||', f.engagement_hk, upper(trim(CAST(l.lobbyist_id AS STRING))))) AS engagement_lobbyist_hk,
         f.filing_uuid, max(trim(l.covered_position)) AS covered_position
  FROM bronze.lda_lobbyists l JOIN silver.v_filing_keys f ON f.filing_uuid = trim(l.filing_uuid)
  GROUP BY 1, 2) s
WHERE NOT EXISTS (SELECT 1 FROM silver.sat_engagement_lobbyist_filing t
  WHERE t.filing_uuid = s.filing_uuid AND t.engagement_lobbyist_hk = s.engagement_lobbyist_hk);

-- sat_client_profile / sat_registrant_profile / sat_lobbyist_profile:
-- descriptive attributes, a new row only when the attributes change.
CREATE TABLE IF NOT EXISTS silver.sat_client_profile (
  client_hk STRING, hash_diff STRING, name STRING, general_description STRING, state STRING,
  country STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.sat_client_profile
SELECT client_hk, hash_diff, name, general_description, state, country, current_timestamp(), 'lda.senate.gov'
FROM (
  SELECT DISTINCT md5(upper(trim(CAST(client_id AS STRING)))) AS client_hk, trim(name) AS name,
         trim(general_description) AS general_description, upper(trim(state)) AS state, upper(trim(country)) AS country,
         md5(concat_ws('||', trim(name), coalesce(trim(general_description), ''), coalesce(upper(trim(state)), ''))) AS hash_diff
  FROM bronze.lda_clients) s
WHERE NOT EXISTS (SELECT 1 FROM silver.sat_client_profile t WHERE t.client_hk = s.client_hk AND t.hash_diff = s.hash_diff);

CREATE TABLE IF NOT EXISTS silver.sat_registrant_profile (
  registrant_hk STRING, hash_diff STRING, name STRING, description STRING, city STRING, state STRING,
  load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.sat_registrant_profile
SELECT registrant_hk, hash_diff, name, description, city, state, current_timestamp(), 'lda.senate.gov'
FROM (
  SELECT DISTINCT md5(upper(trim(CAST(registrant_id AS STRING)))) AS registrant_hk, trim(name) AS name,
         trim(description) AS description, upper(trim(city)) AS city, upper(trim(state)) AS state,
         md5(concat_ws('||', trim(name), coalesce(trim(description), ''), coalesce(upper(trim(city)), ''))) AS hash_diff
  FROM bronze.lda_registrants) s
WHERE NOT EXISTS (SELECT 1 FROM silver.sat_registrant_profile t WHERE t.registrant_hk = s.registrant_hk AND t.hash_diff = s.hash_diff);

CREATE TABLE IF NOT EXISTS silver.sat_lobbyist_profile (
  lobbyist_hk STRING, hash_diff STRING, first_name STRING, last_name STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.sat_lobbyist_profile
SELECT lobbyist_hk, hash_diff, first_name, last_name, current_timestamp(), 'lda.senate.gov'
FROM (
  SELECT DISTINCT md5(upper(trim(CAST(lobbyist_id AS STRING)))) AS lobbyist_hk,
         upper(trim(first_name)) AS first_name, upper(trim(last_name)) AS last_name,
         md5(concat_ws('||', upper(trim(first_name)), upper(trim(last_name)))) AS hash_diff
  FROM bronze.lda_lobbyists) s
WHERE NOT EXISTS (SELECT 1 FROM silver.sat_lobbyist_profile t WHERE t.lobbyist_hk = s.lobbyist_hk AND t.hash_diff = s.hash_diff);

-- =====================================================================
-- GOLD: BUSINESS RULES (soft rules start here)
-- =====================================================================
-- Rules shared by every mart below, stated once:
--   1. A filing's income counts in full toward every issue code it lists,
--      so topic totals overlap and are never summed across topics.
--   2. Registrations (RR, RA) carry no income and are not quarterly reports.
--   3. For one engagement and one period the latest amendment wins.
--   4. engagement_status is lapsed when the latest quarterly report is a
--      termination, or when the last period is before the newest period
--      in the data. Otherwise active. An engagement that has only
--      registered so far is active when the registration was posted in
--      or after the newest quarter (its first report is not due yet) and
--      lapsed when it is older than that. A terminated engagement that
--      registers again and reports again is active once more.
--   5. Income reported as null means 0, in every mart.

-- fact_filing: one row per quarterly report (registrations excluded),
-- latest amendment wins for a given engagement and period. Turns the
-- LDA period label into a real period-end date: the four quarters, plus
-- the semi-annual mid_year and year_end labels used before 2008. An
-- unknown label gives a null date, which tests.sql reports.
CREATE OR REPLACE TABLE gold.fact_filing AS
SELECT s.filing_uuid, s.engagement_hk, l.registrant_hk, l.client_hk, s.filing_year, s.filing_period,
       last_day(make_date(s.filing_year, CASE s.filing_period
                                             WHEN 'first_quarter' THEN 3 WHEN 'second_quarter' THEN 6
                                             WHEN 'third_quarter' THEN 9 WHEN 'fourth_quarter' THEN 12
                                             WHEN 'mid_year' THEN 6 WHEN 'year_end' THEN 12 END, 1)) AS period_end_date,
       s.filing_type,
       CAST(coalesce(s.income, 0) AS DECIMAL(14,2)) AS income,
       CAST(coalesce(s.expenses, 0) AS DECIMAL(14,2)) AS expenses,
       s.termination_date IS NOT NULL AS is_termination, s.dt_posted
FROM silver.sat_engagement_filing s
JOIN silver.link_engagement l ON l.engagement_hk = s.engagement_hk
WHERE s.filing_type NOT IN ('RR', 'RA')
QUALIFY row_number() OVER (PARTITION BY s.engagement_hk, s.filing_year, s.filing_period
                           ORDER BY s.dt_posted DESC, s.load_date DESC, s.filing_uuid) = 1;

-- issue_name: the display name the LDA gives each general issue code
-- (TAX is Taxation/Internal Revenue Code). Bronze keeps it as delivered,
-- the vault keys on the code, so the name is looked up here.
CREATE OR REPLACE TABLE gold.issue_name AS
SELECT upper(trim(general_issue_code)) AS issue_code,
       max_by(trim(general_issue_code_display), load_date) AS issue_name
FROM bronze.lda_lobbying_activities
WHERE general_issue_code IS NOT NULL
GROUP BY upper(trim(general_issue_code));

-- engagement_issue_text: all specific-issue text for an engagement in one
-- string. Input to the AI summary.
CREATE OR REPLACE TABLE gold.engagement_issue_text AS
SELECT engagement_hk,
       array_join(array_sort(collect_set(issue_code)), ', ') AS issue_codes,
       substring(array_join(collect_set(specific_issues), ' | '), 1, 4000) AS issues_text
FROM silver.sat_engagement_issues_text
GROUP BY engagement_hk;

-- filing_bill: bill numbers mentioned in the issue text (H.R. 1, S. 567,
-- H.J.Res. 12 ...), one row per filing, issue code and bill. A soft rule:
-- regex over free text, so it lives in Gold. bill_key is the normalized
-- form used for joins and search, bill_label is the display form. Only
-- registrations and the winning version of each quarterly report are
-- kept (rule 3), so a report and its amendment never count as two
-- filings. period_end_date is null only for a registration.
CREATE OR REPLACE TABLE gold.filing_bill AS
WITH refs AS (
  SELECT t.engagement_hk, t.filing_uuid, t.issue_code,
         regexp_replace(raw_ref, '[^A-Z0-9]', '') AS bill_key
  FROM silver.sat_engagement_issues_text t
  LATERAL VIEW explode(regexp_extract_all(upper(t.specific_issues),
    '(?<!U\\.)\\b(?:H\\.?\\s?J\\.?\\s?RES\\.?|S\\.?\\s?J\\.?\\s?RES\\.?|H\\.?\\s?CON\\.?\\s?RES\\.?|S\\.?\\s?CON\\.?\\s?RES\\.?|H\\.?\\s?RES\\.?|S\\.?\\s?RES\\.?|H\\.?\\s?R\\.?|S\\.)\\s?\\d{1,5}\\b', 0)) AS raw_ref
)
SELECT DISTINCT r.engagement_hk, r.filing_uuid, r.issue_code, r.bill_key,
       CASE regexp_replace(r.bill_key, '[0-9]', '')
         WHEN 'HR' THEN 'H.R. ' WHEN 'S' THEN 'S. '
         WHEN 'HJRES' THEN 'H.J.Res. ' WHEN 'SJRES' THEN 'S.J.Res. '
         WHEN 'HCONRES' THEN 'H.Con.Res. ' WHEN 'SCONRES' THEN 'S.Con.Res. '
         WHEN 'HRES' THEN 'H.Res. ' WHEN 'SRES' THEN 'S.Res. ' END
       || regexp_replace(r.bill_key, '[A-Z]', '') AS bill_label,
       f.period_end_date
FROM refs r
LEFT JOIN gold.fact_filing f ON f.filing_uuid = r.filing_uuid
WHERE f.filing_uuid IS NOT NULL
   OR EXISTS (SELECT 1 FROM silver.sat_engagement_filing s
              WHERE s.filing_uuid = r.filing_uuid AND s.filing_type IN ('RR', 'RA'));

-- engagement_bill: one row per engagement and bill it has lobbied on.
CREATE OR REPLACE TABLE gold.engagement_bill AS
SELECT engagement_hk, bill_key, max(bill_label) AS bill_label,
       count(DISTINCT filing_uuid) AS filings_mentioning,
       min(period_end_date) AS first_period, max(period_end_date) AS last_period,
       array_join(array_sort(collect_set(issue_code)), ', ') AS issue_codes
FROM gold.filing_bill
GROUP BY engagement_hk, bill_key;

-- engagement_ai_summary: one-sentence summary per engagement from a
-- foundation model via ai_query(). Only engagements without a summary are
-- sent to the model, so reruns cost nothing.
CREATE TABLE IF NOT EXISTS gold.engagement_ai_summary (
  engagement_hk STRING, ai_summary STRING, model STRING, load_date TIMESTAMP);

-- AI summaries are not computed in the build for now. To fill the table for a
-- subset later, run the statement in sql/ai_summaries.sql.


-- =====================================================================
-- GOLD: MARTS, ONE PER PAGE
-- =====================================================================

-- engagement_quarter: one row per engagement and quarter it reported.
-- The spine of every chart. Quarters with no report have no row, so a
-- chart never carries a value forward past a termination.
CREATE OR REPLACE TABLE gold.engagement_quarter AS
SELECT f.engagement_hk, f.period_end_date, f.income, f.filing_type, f.is_termination,
       CAST(coalesce(lb.lobbyist_count, 0) AS INT) AS lobbyist_count,
       ic.issue_codes, bl.bill_labels
FROM gold.fact_filing f
LEFT JOIN (SELECT filing_uuid, count(DISTINCT engagement_lobbyist_hk) AS lobbyist_count
           FROM silver.sat_engagement_lobbyist_filing GROUP BY filing_uuid) lb ON lb.filing_uuid = f.filing_uuid
LEFT JOIN (SELECT filing_uuid, array_join(array_sort(collect_set(issue_code)), ', ') AS issue_codes
           FROM silver.sat_engagement_issues_text GROUP BY filing_uuid) ic ON ic.filing_uuid = f.filing_uuid
LEFT JOIN (SELECT filing_uuid, array_join(array_sort(collect_set(bill_label)), ', ') AS bill_labels
           FROM gold.filing_bill GROUP BY filing_uuid) bl ON bl.filing_uuid = f.filing_uuid;

-- engagement: one row per registrant-client pair with everything the
-- engagement table shows. Covers every link_engagement row, including
-- one that has only registered so far.
CREATE OR REPLACE TABLE gold.engagement AS
WITH newest AS (SELECT max(period_end_date) AS newest_period FROM gold.fact_filing),
client_profile AS (
  SELECT client_hk, name, general_description FROM silver.sat_client_profile
  QUALIFY row_number() OVER (PARTITION BY client_hk ORDER BY load_date DESC, hash_diff) = 1),
firm_profile AS (
  SELECT registrant_hk, name FROM silver.sat_registrant_profile
  QUALIFY row_number() OVER (PARTITION BY registrant_hk ORDER BY load_date DESC, hash_diff) = 1),
registered AS (
  SELECT engagement_hk, max(dt_posted) AS registered_at
  FROM silver.sat_engagement_filing WHERE filing_type IN ('RR', 'RA') GROUP BY engagement_hk),
reports AS (
  SELECT engagement_hk, sum(income) AS total_income, min(period_end_date) AS first_period,
         max(period_end_date) AS last_period, count(DISTINCT period_end_date) AS quarters_active
  FROM gold.fact_filing GROUP BY engagement_hk),
last_report AS (
  SELECT engagement_hk, is_termination FROM gold.fact_filing
  QUALIFY row_number() OVER (PARTITION BY engagement_hk ORDER BY period_end_date DESC, dt_posted DESC) = 1),
bills AS (
  SELECT engagement_hk, array_join(array_sort(collect_set(bill_label)), ', ') AS bill_labels
  FROM gold.engagement_bill GROUP BY engagement_hk),
entities AS (
  SELECT l.engagement_hk, array_join(array_sort(collect_set(h.entity_bk)), ', ') AS government_entities
  FROM silver.link_engagement_government_entity l
  JOIN silver.hub_government_entity h ON h.entity_hk = l.entity_hk
  GROUP BY l.engagement_hk)
SELECT e.engagement_hk,
       hc.client_bk AS client_id, cp.name AS client, cp.general_description AS client_description,
       hr.registrant_bk AS registrant_id, fp.name AS firm,
       t.issue_codes, b.bill_labels, g.government_entities,
       CAST(coalesce(r.total_income, 0) AS DECIMAL(14,2)) AS total_income,
       r.first_period, r.last_period,
       CAST(coalesce(r.quarters_active, 0) AS INT) AS quarters_active,
       CASE WHEN r.last_period IS NULL AND reg.registered_at >= date_trunc('QUARTER', n.newest_period) THEN 'active'
            WHEN r.last_period IS NULL THEN 'lapsed'
            WHEN lr.is_termination THEN 'lapsed'
            WHEN r.last_period < n.newest_period THEN 'lapsed'
            ELSE 'active' END AS engagement_status,
       a.ai_summary
FROM silver.link_engagement e
CROSS JOIN newest n
JOIN silver.hub_client hc ON hc.client_hk = e.client_hk
JOIN silver.hub_registrant hr ON hr.registrant_hk = e.registrant_hk
LEFT JOIN client_profile cp ON cp.client_hk = e.client_hk
LEFT JOIN firm_profile fp ON fp.registrant_hk = e.registrant_hk
LEFT JOIN gold.engagement_issue_text t ON t.engagement_hk = e.engagement_hk
LEFT JOIN bills b ON b.engagement_hk = e.engagement_hk
LEFT JOIN entities g ON g.engagement_hk = e.engagement_hk
LEFT JOIN reports r ON r.engagement_hk = e.engagement_hk
LEFT JOIN registered reg ON reg.engagement_hk = e.engagement_hk
LEFT JOIN last_report lr ON lr.engagement_hk = e.engagement_hk
LEFT JOIN gold.engagement_ai_summary a ON a.engagement_hk = e.engagement_hk;

-- topic_quarter: income by issue code and quarter. Built by exploding
-- engagement_quarter on its issue codes (rule 1), so a quarter with a
-- report and no income still has a row with 0.
CREATE OR REPLACE TABLE gold.topic_quarter AS
SELECT x.issue_code, q.period_end_date,
       CAST(sum(q.income) AS DECIMAL(14,2)) AS income,
       CAST(count(DISTINCT q.engagement_hk) AS INT) AS engagement_count,
       CAST(count(DISTINCT e.client_hk) AS INT) AS client_count,
       CAST(count(DISTINCT e.registrant_hk) AS INT) AS firm_count
FROM gold.engagement_quarter q
JOIN silver.link_engagement e ON e.engagement_hk = q.engagement_hk
LATERAL VIEW explode(split(q.issue_codes, ', ')) x AS issue_code
WHERE q.issue_codes IS NOT NULL
GROUP BY x.issue_code, q.period_end_date;

-- topic: one row per issue code ever listed on a filing, including
-- registrations, so an issue with filings but no income still has a page.
-- rank is 1 for the issue with the most reported income.
CREATE OR REPLACE TABLE gold.topic AS
WITH listed AS (
  SELECT hi.issue_bk AS issue_code,
         count(DISTINCT li.engagement_hk) AS engagement_count,
         count(DISTINCT e.client_hk) AS client_count,
         count(DISTINCT e.registrant_hk) AS firm_count
  FROM silver.link_engagement_issue li
  JOIN silver.hub_issue hi ON hi.issue_hk = li.issue_hk
  JOIN silver.link_engagement e ON e.engagement_hk = li.engagement_hk
  GROUP BY hi.issue_bk),
reported AS (SELECT issue_code, sum(income) AS total_income FROM gold.topic_quarter GROUP BY issue_code)
SELECT l.issue_code, coalesce(n.issue_name, l.issue_code) AS issue_name,
       CAST(coalesce(r.total_income, 0) AS DECIMAL(14,2)) AS total_income,
       CAST(l.engagement_count AS INT) AS engagement_count,
       CAST(l.client_count AS INT) AS client_count,
       CAST(l.firm_count AS INT) AS firm_count,
       CAST(row_number() OVER (ORDER BY coalesce(r.total_income, 0) DESC, l.issue_code) AS INT) AS rank
FROM listed l
LEFT JOIN reported r ON r.issue_code = l.issue_code
LEFT JOIN gold.issue_name n ON n.issue_code = l.issue_code;

-- topic_client: clients ranked by income within an issue code.
CREATE OR REPLACE TABLE gold.topic_client AS
SELECT issue_code, client_id, client, income,
       CAST(row_number() OVER (PARTITION BY issue_code ORDER BY income DESC, client, client_id) AS INT) AS rank
FROM (
  SELECT x.issue_code, g.client_id, g.client, CAST(sum(q.income) AS DECIMAL(14,2)) AS income
  FROM gold.engagement_quarter q
  JOIN gold.engagement g ON g.engagement_hk = q.engagement_hk
  LATERAL VIEW explode(split(q.issue_codes, ', ')) x AS issue_code
  WHERE q.issue_codes IS NOT NULL
  GROUP BY x.issue_code, g.client_id, g.client);

-- topic_firm: firms ranked by income within an issue code.
CREATE OR REPLACE TABLE gold.topic_firm AS
SELECT issue_code, registrant_id, firm, income,
       CAST(row_number() OVER (PARTITION BY issue_code ORDER BY income DESC, firm, registrant_id) AS INT) AS rank
FROM (
  SELECT x.issue_code, g.registrant_id, g.firm, CAST(sum(q.income) AS DECIMAL(14,2)) AS income
  FROM gold.engagement_quarter q
  JOIN gold.engagement g ON g.engagement_hk = q.engagement_hk
  LATERAL VIEW explode(split(q.issue_codes, ', ')) x AS issue_code
  WHERE q.issue_codes IS NOT NULL
  GROUP BY x.issue_code, g.registrant_id, g.firm);

-- topic_bill: bills cited under an issue code.
CREATE OR REPLACE TABLE gold.topic_bill AS
SELECT issue_code, bill_key, max(bill_label) AS bill_label,
       CAST(count(DISTINCT engagement_hk) AS INT) AS engagement_count,
       CAST(count(DISTINCT filing_uuid) AS INT) AS filings_mentioning
FROM gold.filing_bill
GROUP BY issue_code, bill_key;

-- bill: one row per bill cited anywhere in the issue text.
CREATE OR REPLACE TABLE gold.bill AS
SELECT bill_key, max(bill_label) AS bill_label,
       CAST(count(DISTINCT engagement_hk) AS INT) AS engagement_count,
       CAST(count(DISTINCT filing_uuid) AS INT) AS filings_mentioning,
       min(period_end_date) AS first_period, max(period_end_date) AS last_period,
       array_join(array_sort(collect_set(issue_code)), ', ') AS issue_codes
FROM gold.filing_bill
GROUP BY bill_key;

-- bill_quarter: how many quarterly reports cited the bill each quarter.
CREATE OR REPLACE TABLE gold.bill_quarter AS
SELECT bill_key, period_end_date,
       CAST(count(DISTINCT filing_uuid) AS INT) AS filings_mentioning,
       CAST(count(DISTINCT engagement_hk) AS INT) AS engagement_count
FROM gold.filing_bill
WHERE period_end_date IS NOT NULL
GROUP BY bill_key, period_end_date;

-- client: one row per client with the firms it hired and its totals.
CREATE OR REPLACE TABLE gold.client AS
WITH profile AS (
  SELECT client_hk, name, general_description, state FROM silver.sat_client_profile
  QUALIFY row_number() OVER (PARTITION BY client_hk ORDER BY load_date DESC, hash_diff) = 1),
eng AS (
  SELECT e.client_hk, count(*) AS engagement_count, count(DISTINCT e.registrant_hk) AS firm_count,
         array_join(array_sort(collect_set(g.firm)), ', ') AS firms, sum(g.total_income) AS total_income
  FROM silver.link_engagement e
  JOIN gold.engagement g ON g.engagement_hk = e.engagement_hk
  GROUP BY e.client_hk),
quarters AS (
  SELECT e.client_hk, count(DISTINCT q.period_end_date) AS quarters_active
  FROM gold.engagement_quarter q
  JOIN silver.link_engagement e ON e.engagement_hk = q.engagement_hk
  GROUP BY e.client_hk),
issues AS (
  SELECT e.client_hk, array_join(array_sort(collect_set(hi.issue_bk)), ', ') AS issue_codes
  FROM silver.link_engagement_issue li
  JOIN silver.hub_issue hi ON hi.issue_hk = li.issue_hk
  JOIN silver.link_engagement e ON e.engagement_hk = li.engagement_hk
  GROUP BY e.client_hk),
people AS (
  SELECT e.client_hk, count(DISTINCT ll.lobbyist_hk) AS lobbyist_count
  FROM silver.link_engagement_lobbyist ll
  JOIN silver.link_engagement e ON e.engagement_hk = ll.engagement_hk
  GROUP BY e.client_hk)
SELECT hc.client_bk AS client_id, p.name, p.general_description AS description, p.state,
       CAST(coalesce(eng.firm_count, 0) AS INT) AS firm_count, eng.firms,
       CAST(coalesce(eng.total_income, 0) AS DECIMAL(14,2)) AS total_income,
       CAST(coalesce(quarters.quarters_active, 0) AS INT) AS quarters_active,
       issues.issue_codes,
       CAST(coalesce(people.lobbyist_count, 0) AS INT) AS lobbyist_count,
       CAST(coalesce(eng.engagement_count, 0) AS INT) AS engagement_count
FROM silver.hub_client hc
LEFT JOIN profile p ON p.client_hk = hc.client_hk
LEFT JOIN eng ON eng.client_hk = hc.client_hk
LEFT JOIN quarters ON quarters.client_hk = hc.client_hk
LEFT JOIN issues ON issues.client_hk = hc.client_hk
LEFT JOIN people ON people.client_hk = hc.client_hk;

-- client_quarter: income reported on a client's filings by quarter.
CREATE OR REPLACE TABLE gold.client_quarter AS
SELECT hc.client_bk AS client_id, q.period_end_date,
       CAST(sum(q.income) AS DECIMAL(14,2)) AS income,
       CAST(count(DISTINCT q.engagement_hk) AS INT) AS engagement_count
FROM gold.engagement_quarter q
JOIN silver.link_engagement e ON e.engagement_hk = q.engagement_hk
JOIN silver.hub_client hc ON hc.client_hk = e.client_hk
GROUP BY hc.client_bk, q.period_end_date;

-- firm: one row per registrant (lobbying firm) with its totals.
CREATE OR REPLACE TABLE gold.firm AS
WITH profile AS (
  SELECT registrant_hk, name, description, city, state FROM silver.sat_registrant_profile
  QUALIFY row_number() OVER (PARTITION BY registrant_hk ORDER BY load_date DESC, hash_diff) = 1),
eng AS (
  SELECT e.registrant_hk, count(*) AS engagement_count, count(DISTINCT e.client_hk) AS client_count,
         sum(g.total_income) AS total_income
  FROM silver.link_engagement e
  JOIN gold.engagement g ON g.engagement_hk = e.engagement_hk
  GROUP BY e.registrant_hk),
issues AS (
  SELECT e.registrant_hk, array_join(array_sort(collect_set(hi.issue_bk)), ', ') AS issue_codes
  FROM silver.link_engagement_issue li
  JOIN silver.hub_issue hi ON hi.issue_hk = li.issue_hk
  JOIN silver.link_engagement e ON e.engagement_hk = li.engagement_hk
  GROUP BY e.registrant_hk),
people AS (
  SELECT e.registrant_hk, count(DISTINCT ll.lobbyist_hk) AS lobbyist_count
  FROM silver.link_engagement_lobbyist ll
  JOIN silver.link_engagement e ON e.engagement_hk = ll.engagement_hk
  GROUP BY e.registrant_hk)
SELECT hr.registrant_bk AS registrant_id, p.name, p.description, p.city, p.state,
       CAST(coalesce(eng.client_count, 0) AS INT) AS client_count,
       CAST(coalesce(eng.total_income, 0) AS DECIMAL(14,2)) AS total_income,
       issues.issue_codes,
       CAST(coalesce(people.lobbyist_count, 0) AS INT) AS lobbyist_count,
       CAST(coalesce(eng.engagement_count, 0) AS INT) AS engagement_count
FROM silver.hub_registrant hr
LEFT JOIN profile p ON p.registrant_hk = hr.registrant_hk
LEFT JOIN eng ON eng.registrant_hk = hr.registrant_hk
LEFT JOIN issues ON issues.registrant_hk = hr.registrant_hk
LEFT JOIN people ON people.registrant_hk = hr.registrant_hk;

-- firm_quarter: a firm's income by quarter across all of its clients.
CREATE OR REPLACE TABLE gold.firm_quarter AS
SELECT hr.registrant_bk AS registrant_id, q.period_end_date,
       CAST(sum(q.income) AS DECIMAL(14,2)) AS income,
       CAST(count(DISTINCT e.client_hk) AS INT) AS client_count
FROM gold.engagement_quarter q
JOIN silver.link_engagement e ON e.engagement_hk = q.engagement_hk
JOIN silver.hub_registrant hr ON hr.registrant_hk = e.registrant_hk
GROUP BY hr.registrant_bk, q.period_end_date;

-- lobbyist: one row per individual lobbyist. covered_positions is the
-- disclosed former government roles, verbatim from the filings, distinct
-- and joined with ' | '. Quarters count the quarterly reports that list
-- the person, so someone named only on a registration has 0.
CREATE OR REPLACE TABLE gold.lobbyist AS
WITH profile AS (
  SELECT lobbyist_hk, first_name, last_name FROM silver.sat_lobbyist_profile
  QUALIFY row_number() OVER (PARTITION BY lobbyist_hk ORDER BY load_date DESC, hash_diff) = 1),
listed AS (
  SELECT ll.lobbyist_hk, e.client_hk, e.registrant_hk, f.period_end_date, sf.covered_position
  FROM silver.link_engagement_lobbyist ll
  JOIN silver.link_engagement e ON e.engagement_hk = ll.engagement_hk
  JOIN silver.sat_engagement_lobbyist_filing sf ON sf.engagement_lobbyist_hk = ll.engagement_lobbyist_hk
  LEFT JOIN gold.fact_filing f ON f.filing_uuid = sf.filing_uuid),
agg AS (
  SELECT lobbyist_hk,
         count(DISTINCT client_hk) AS client_count, count(DISTINCT registrant_hk) AS firm_count,
         count(DISTINCT period_end_date) AS quarters_active,
         min(period_end_date) AS first_period, max(period_end_date) AS last_period,
         nullif(array_join(array_sort(collect_set(nullif(trim(covered_position), ''))), ' | '), '') AS covered_positions
  FROM listed GROUP BY lobbyist_hk)
SELECT hl.lobbyist_bk AS lobbyist_id,
       initcap(concat_ws(' ', p.first_name, p.last_name)) AS full_name,
       a.covered_positions,
       CAST(coalesce(a.client_count, 0) AS INT) AS client_count,
       CAST(coalesce(a.firm_count, 0) AS INT) AS firm_count,
       CAST(coalesce(a.quarters_active, 0) AS INT) AS quarters_active,
       a.first_period, a.last_period
FROM silver.hub_lobbyist hl
LEFT JOIN profile p ON p.lobbyist_hk = hl.lobbyist_hk
LEFT JOIN agg a ON a.lobbyist_hk = hl.lobbyist_hk;

-- lobbyist_engagement: one row per lobbyist and engagement that listed
-- them, with the quarters and the income reported while they were listed.
CREATE OR REPLACE TABLE gold.lobbyist_engagement AS
WITH listed AS (
  SELECT DISTINCT ll.lobbyist_hk, ll.engagement_hk, f.filing_uuid, f.period_end_date, f.income
  FROM silver.link_engagement_lobbyist ll
  JOIN silver.sat_engagement_lobbyist_filing sf ON sf.engagement_lobbyist_hk = ll.engagement_lobbyist_hk
  JOIN gold.fact_filing f ON f.filing_uuid = sf.filing_uuid)
SELECT hl.lobbyist_bk AS lobbyist_id, ll.engagement_hk,
       g.client_id, g.client, g.registrant_id, g.firm,
       min(l.period_end_date) AS first_period, max(l.period_end_date) AS last_period,
       CAST(count(DISTINCT l.period_end_date) AS INT) AS quarters_listed,
       CAST(coalesce(sum(l.income), 0) AS DECIMAL(14,2)) AS income_while_listed
FROM silver.link_engagement_lobbyist ll
JOIN silver.hub_lobbyist hl ON hl.lobbyist_hk = ll.lobbyist_hk
JOIN gold.engagement g ON g.engagement_hk = ll.engagement_hk
LEFT JOIN listed l ON l.lobbyist_hk = ll.lobbyist_hk AND l.engagement_hk = ll.engagement_hk
GROUP BY hl.lobbyist_bk, ll.engagement_hk, g.client_id, g.client, g.registrant_id, g.firm;

-- search_entity: every client and firm name in one list for the home
-- page search box.
CREATE OR REPLACE TABLE gold.search_entity AS
SELECT 'client' AS kind, client_id AS id, name, total_income FROM gold.client
UNION ALL
SELECT 'firm' AS kind, registrant_id AS id, name, total_income FROM gold.firm;
