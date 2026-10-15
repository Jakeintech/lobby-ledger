-- northstar.sql
-- Builds the Silver Raw Vault and the Gold Business Vault + marts from Bronze.
-- Idempotent: safe to run again. Hubs, links and satellites only insert rows
-- they have not seen; Gold is rebuilt from Silver on every run.
-- Run with: python3 sql/run_sql.py sql/northstar.sql
--
-- Hard rules (Silver): cast, trim, upper, md5, dedupe. No business meaning.
-- Soft rules (Gold): status, totals, as-of logic, anything a business user
-- could argue about.

CREATE SCHEMA IF NOT EXISTS silver;
CREATE SCHEMA IF NOT EXISTS gold;

-- =====================================================================
-- SILVER: RAW VAULT
-- =====================================================================

-- hub_registrant: one row per lobbying firm ever seen (the "law firm").
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

-- hub_lobbyist: one row per individual lobbyist (the "timekeeper").
CREATE TABLE IF NOT EXISTS silver.hub_lobbyist (
  lobbyist_hk STRING, lobbyist_bk STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.hub_lobbyist
SELECT DISTINCT md5(upper(trim(CAST(lobbyist_id AS STRING)))), upper(trim(CAST(lobbyist_id AS STRING))),
       current_timestamp(), 'lda.senate.gov'
FROM bronze.lda_lobbyists s
WHERE NOT EXISTS (SELECT 1 FROM silver.hub_lobbyist h
                  WHERE h.lobbyist_hk = md5(upper(trim(CAST(s.lobbyist_id AS STRING)))));

-- hub_issue: one row per general issue code (the "practice group").
CREATE TABLE IF NOT EXISTS silver.hub_issue (
  issue_hk STRING, issue_bk STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.hub_issue
SELECT DISTINCT md5(upper(trim(general_issue_code))), upper(trim(general_issue_code)),
       current_timestamp(), 'lda.senate.gov'
FROM bronze.lda_lobbying_activities s
WHERE NOT EXISTS (SELECT 1 FROM silver.hub_issue h
                  WHERE h.issue_hk = md5(upper(trim(s.general_issue_code))));

-- link_engagement: the "matter". A registrant working for a client.
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

-- sat_engagement_filing: one row per quarterly filing of an engagement.
-- This is the type-2 history of the matter: income, filing type and
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
-- any quarter.
CREATE TABLE IF NOT EXISTS silver.sat_engagement_lobbyist_filing (
  engagement_lobbyist_hk STRING, filing_uuid STRING, covered_position STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.sat_engagement_lobbyist_filing
SELECT DISTINCT md5(concat_ws('||', f.engagement_hk, upper(trim(CAST(l.lobbyist_id AS STRING))))),
       f.filing_uuid, trim(l.covered_position), current_timestamp(), 'lda.senate.gov'
FROM bronze.lda_lobbyists l JOIN silver.v_filing_keys f ON f.filing_uuid = trim(l.filing_uuid)
WHERE NOT EXISTS (SELECT 1 FROM silver.sat_engagement_lobbyist_filing t
  WHERE t.filing_uuid = f.filing_uuid
    AND t.engagement_lobbyist_hk = md5(concat_ws('||', f.engagement_hk, upper(trim(CAST(l.lobbyist_id AS STRING))))));

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
-- GOLD: BUSINESS VAULT (soft rules start here)
-- =====================================================================

-- fact_filing: one row per quarterly report (registrations excluded),
-- latest amendment wins for a given engagement and period. Turns the
-- LDA period label into a real quarter-end date.
CREATE OR REPLACE TABLE gold.fact_filing AS
SELECT s.filing_uuid, s.engagement_hk, l.registrant_hk, l.client_hk, s.filing_year, s.filing_period,
       last_day(make_date(s.filing_year, CASE s.filing_period WHEN 'first_quarter' THEN 3 WHEN 'second_quarter' THEN 6
                                             WHEN 'third_quarter' THEN 9 ELSE 12 END, 1)) AS period_end_date,
       s.filing_type, coalesce(s.income, 0) AS income, coalesce(s.expenses, 0) AS expenses,
       s.termination_date IS NOT NULL AS is_termination, s.dt_posted
FROM silver.sat_engagement_filing s
JOIN silver.link_engagement l ON l.engagement_hk = s.engagement_hk
WHERE s.filing_type <> 'RR'
QUALIFY row_number() OVER (PARTITION BY s.engagement_hk, s.filing_year, s.filing_period ORDER BY s.dt_posted DESC) = 1;

-- pit_engagement: point-in-time table. For every engagement and every
-- quarter end, the filing that was current on that date. Queries join
-- to it instead of writing "latest row as of" logic over and over.
CREATE OR REPLACE TABLE gold.pit_engagement AS
WITH quarters AS (
  SELECT explode(sequence(DATE'2024-03-31', DATE'2025-12-31', INTERVAL 3 MONTH)) AS q),
snap AS (
  SELECT last_day(q) AS snapshot_date FROM quarters)
SELECT e.engagement_hk, s.snapshot_date,
       max_by(f.filing_uuid, f.period_end_date) AS filing_uuid,
       max(f.period_end_date) AS as_of_period_end
FROM silver.link_engagement e
CROSS JOIN snap s
JOIN gold.fact_filing f ON f.engagement_hk = e.engagement_hk AND f.period_end_date <= s.snapshot_date
GROUP BY e.engagement_hk, s.snapshot_date;

-- bridge_registrant_client_lobbyist: flattens hub-link-hub paths into one
-- row per engagement, lobbyist and filing so the app does not walk the vault.
CREATE OR REPLACE TABLE gold.bridge_registrant_client_lobbyist AS
SELECT f.engagement_hk, f.registrant_hk, f.client_hk, el.lobbyist_hk, f.filing_uuid, f.period_end_date
FROM silver.sat_engagement_lobbyist_filing sl
JOIN silver.link_engagement_lobbyist el ON el.engagement_lobbyist_hk = sl.engagement_lobbyist_hk
JOIN gold.fact_filing f ON f.filing_uuid = sl.filing_uuid
GROUP BY ALL;

-- sat_engagement_computed: business rules. "Lapsed" means the engagement
-- terminated or did not file in the latest quarter in the data set.
CREATE OR REPLACE TABLE gold.sat_engagement_computed AS
WITH latest AS (SELECT max(period_end_date) AS max_period FROM gold.fact_filing)
SELECT f.engagement_hk,
       min(f.period_end_date) AS first_period,
       max(f.period_end_date) AS last_period,
       count(DISTINCT f.period_end_date) AS quarters_active,
       sum(f.income) AS total_income,
       CASE WHEN bool_or(f.is_termination) OR max(f.period_end_date) < max(latest.max_period)
            THEN 'lapsed' ELSE 'active' END AS engagement_status,
       current_timestamp() AS load_date
FROM gold.fact_filing f CROSS JOIN latest
GROUP BY f.engagement_hk;

-- =====================================================================
-- GOLD: MARTS
-- =====================================================================

CREATE OR REPLACE TABLE gold.dim_registrant AS
SELECT h.registrant_hk, h.registrant_bk AS registrant_id, s.name, s.description, s.city, s.state
FROM silver.hub_registrant h
JOIN silver.sat_registrant_profile s ON s.registrant_hk = h.registrant_hk
QUALIFY row_number() OVER (PARTITION BY h.registrant_hk ORDER BY s.load_date DESC) = 1;

CREATE OR REPLACE TABLE gold.dim_client AS
SELECT h.client_hk, h.client_bk AS client_id, s.name, s.general_description, s.state
FROM silver.hub_client h
JOIN silver.sat_client_profile s ON s.client_hk = h.client_hk
QUALIFY row_number() OVER (PARTITION BY h.client_hk ORDER BY s.load_date DESC) = 1;

CREATE OR REPLACE TABLE gold.dim_lobbyist AS
SELECT h.lobbyist_hk, h.lobbyist_bk AS lobbyist_id, initcap(s.first_name) AS first_name,
       initcap(s.last_name) AS last_name, initcap(concat_ws(' ', s.first_name, s.last_name)) AS full_name
FROM silver.hub_lobbyist h
JOIN silver.sat_lobbyist_profile s ON s.lobbyist_hk = h.lobbyist_hk
QUALIFY row_number() OVER (PARTITION BY h.lobbyist_hk ORDER BY s.load_date DESC) = 1;

-- engagement_issue_text: all specific-issue text for an engagement in one
-- string. Input to the AI summary and to keyword search.
CREATE OR REPLACE TABLE gold.engagement_issue_text AS
SELECT engagement_hk,
       array_join(array_sort(collect_set(issue_code)), ', ') AS issue_codes,
       substring(array_join(collect_set(specific_issues), ' | '), 1, 4000) AS issues_text
FROM silver.sat_engagement_issues_text
GROUP BY engagement_hk;

-- engagement_ai_summary: one-sentence summary per engagement from a
-- foundation model via ai_query(). Only engagements without a summary are
-- sent to the model, so reruns cost nothing.
CREATE TABLE IF NOT EXISTS gold.engagement_ai_summary (
  engagement_hk STRING, ai_summary STRING, model STRING, load_date TIMESTAMP);

INSERT INTO gold.engagement_ai_summary
SELECT t.engagement_hk,
       ai_query('${AI_ENDPOINT}',
         concat('In one plain sentence of at most 30 words, summarize what this lobbying engagement was about. ',
                'Issue codes: ', t.issue_codes, '. Filing text: ', t.issues_text)),
       '${AI_ENDPOINT}', current_timestamp()
FROM gold.engagement_issue_text t
WHERE NOT EXISTS (SELECT 1 FROM gold.engagement_ai_summary s WHERE s.engagement_hk = t.engagement_hk);

-- experience_search: the product table. One row per engagement with
-- everything the search screen needs. Apps read this, never the vault.
CREATE OR REPLACE VIEW gold.experience_search AS
SELECT e.engagement_hk,
       r.name AS firm,
       c.name AS client,
       c.general_description AS client_description,
       t.issue_codes,
       (SELECT count(DISTINCT b.lobbyist_hk) FROM gold.bridge_registrant_client_lobbyist b
         WHERE b.engagement_hk = e.engagement_hk) AS lobbyist_count,
       x.total_income, x.first_period, x.last_period, x.quarters_active, x.engagement_status,
       a.ai_summary, t.issues_text
FROM silver.link_engagement e
JOIN gold.sat_engagement_computed x ON x.engagement_hk = e.engagement_hk
JOIN gold.dim_registrant r ON r.registrant_hk = e.registrant_hk
JOIN gold.dim_client c ON c.client_hk = e.client_hk
LEFT JOIN gold.engagement_issue_text t ON t.engagement_hk = e.engagement_hk
LEFT JOIN gold.engagement_ai_summary a ON a.engagement_hk = e.engagement_hk;

-- =====================================================================
-- GOLD: ACCESS DEMO
-- =====================================================================

-- engagement_access: who may see which engagement (ethical walls in the
-- law-firm version). Seeded so the person running this script can see
-- every engagement except those for one firm.
CREATE OR REPLACE TABLE gold.engagement_access AS
SELECT current_user() AS user_email, e.engagement_hk
FROM silver.link_engagement e
JOIN gold.dim_registrant r ON r.registrant_hk = e.registrant_hk
WHERE r.name NOT LIKE 'SQUIRE PATTON BOGGS%';

-- experience_search_secure: the same rows, filtered to the caller.
-- current_user() is the signed-in person when a query runs on behalf of
-- the user, and the app's service principal otherwise.
CREATE OR REPLACE VIEW gold.experience_search_secure AS
SELECT s.* FROM gold.experience_search s
WHERE EXISTS (SELECT 1 FROM gold.engagement_access a
              WHERE a.engagement_hk = s.engagement_hk AND a.user_email = current_user());
