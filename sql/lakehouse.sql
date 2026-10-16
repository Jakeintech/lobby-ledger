-- lakehouse.sql
-- Builds the Silver Raw Vault and the Gold marts (one per page) from Bronze,
-- including the keyword, government entity, revolving door, foreign and
-- bill marts of the connect-the-dots addendum.
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

-- hub_organization: one row per organization behind the client records.
-- In LDA data a client id belongs to one registrant, so one organization
-- hired by three firms is three client rows. The business key is the
-- client name upper-cased with everything but letters, digits and single
-- spaces removed, then any run of trailing corporate suffixes (INC,
-- INCORPORATED, LLC, CORP, CORPORATION, CO, COMPANY, LTD, LIMITED, LP,
-- PLC, LLP) dropped, so "ACME, INC.", "Acme Inc", "ACME CO INC" and
-- "ACME" resolve to the same organization. Hard rules only: upper,
-- regexp strip, trim, md5. The spec's item 0 writes the shorter form;
-- this expression is the one in force, applied identically below in
-- link_client_organization.
CREATE TABLE IF NOT EXISTS silver.hub_organization (
  organization_hk STRING, organization_bk STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.hub_organization
SELECT DISTINCT md5(organization_bk), organization_bk, current_timestamp(), 'lda.senate.gov'
FROM (SELECT regexp_replace(trim(regexp_replace(regexp_replace(upper(trim(name)), '[^A-Z0-9 ]', ''), ' +', ' ')), '( (INC|INCORPORATED|LLC|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|LP|PLC|LLP))+$', '') AS organization_bk
      FROM bronze.lda_clients WHERE name IS NOT NULL) s
WHERE organization_bk <> ''
  AND NOT EXISTS (SELECT 1 FROM silver.hub_organization h WHERE h.organization_hk = md5(s.organization_bk));

-- link_client_organization: which organization a client record belongs to.
CREATE TABLE IF NOT EXISTS silver.link_client_organization (
  client_organization_hk STRING, client_hk STRING, organization_hk STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.link_client_organization
SELECT DISTINCT md5(concat_ws('||', client_hk, organization_hk)), client_hk, organization_hk, current_timestamp(), 'lda.senate.gov'
FROM (SELECT md5(upper(trim(CAST(client_id AS STRING)))) AS client_hk,
             md5(regexp_replace(trim(regexp_replace(regexp_replace(upper(trim(name)), '[^A-Z0-9 ]', ''), ' +', ' ')), '( (INC|INCORPORATED|LLC|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|LP|PLC|LLP))+$', '')) AS organization_hk
      FROM bronze.lda_clients
      WHERE name IS NOT NULL AND regexp_replace(trim(regexp_replace(regexp_replace(upper(trim(name)), '[^A-Z0-9 ]', ''), ' +', ' ')), '( (INC|INCORPORATED|LLC|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|LP|PLC|LLP))+$', '') <> '') s
WHERE NOT EXISTS (SELECT 1 FROM silver.link_client_organization l
                  WHERE l.client_organization_hk = md5(concat_ws('||', s.client_hk, s.organization_hk)));

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

-- sat_client_ppb: the client's principal place of business country, a
-- column the source started delivering later. It lives in its own
-- satellite so sat_client_profile keeps its hash_diff and its history.
-- Rows only when the source delivers a value.
CREATE TABLE IF NOT EXISTS silver.sat_client_ppb (
  client_hk STRING, hash_diff STRING, ppb_country STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.sat_client_ppb
SELECT client_hk, hash_diff, ppb_country, current_timestamp(), 'lda.senate.gov'
FROM (
  SELECT DISTINCT md5(upper(trim(CAST(client_id AS STRING)))) AS client_hk,
         upper(trim(ppb_country)) AS ppb_country, md5(upper(trim(ppb_country))) AS hash_diff
  FROM bronze.lda_clients
  WHERE ppb_country IS NOT NULL AND trim(ppb_country) <> '') s
WHERE NOT EXISTS (SELECT 1 FROM silver.sat_client_ppb t WHERE t.client_hk = s.client_hk AND t.hash_diff = s.hash_diff);

-- sat_engagement_government_entity_filing: effectivity satellite saying
-- which filing listed which government entity (under which issue code,
-- since the link key carries the issue code). Lets Gold put a contact in
-- its quarter instead of spreading it over the whole engagement.
CREATE TABLE IF NOT EXISTS silver.sat_engagement_government_entity_filing (
  engagement_entity_hk STRING, filing_uuid STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.sat_engagement_government_entity_filing
SELECT s.engagement_entity_hk, s.filing_uuid, current_timestamp(), 'lda.senate.gov'
FROM (
  SELECT DISTINCT md5(concat_ws('||', f.engagement_hk, md5(upper(trim(g.entity_name))), upper(trim(g.general_issue_code)))) AS engagement_entity_hk,
         f.filing_uuid
  FROM bronze.lda_government_entities g JOIN silver.v_filing_keys f ON f.filing_uuid = trim(g.filing_uuid)
  WHERE g.entity_name IS NOT NULL) s
WHERE NOT EXISTS (SELECT 1 FROM silver.sat_engagement_government_entity_filing t
                  WHERE t.filing_uuid = s.filing_uuid AND t.engagement_entity_hk = s.engagement_entity_hk);

-- hub_foreign_entity: one row per foreign entity a filing names as holding
-- an interest in, or contributing to, the client. The name is the business key.
CREATE TABLE IF NOT EXISTS silver.hub_foreign_entity (
  foreign_entity_hk STRING, foreign_entity_bk STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.hub_foreign_entity
SELECT DISTINCT md5(upper(trim(name))), upper(trim(name)), current_timestamp(), 'lda.senate.gov'
FROM bronze.lda_foreign_entities s
WHERE name IS NOT NULL AND trim(name) <> ''
  AND NOT EXISTS (SELECT 1 FROM silver.hub_foreign_entity h WHERE h.foreign_entity_hk = md5(upper(trim(s.name))));

-- link_engagement_foreign_entity: which foreign entities an engagement has
-- ever named. The filing-level detail sits in sat_foreign_entity_filing.
CREATE TABLE IF NOT EXISTS silver.link_engagement_foreign_entity (
  engagement_foreign_entity_hk STRING, engagement_hk STRING, foreign_entity_hk STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.link_engagement_foreign_entity
SELECT DISTINCT md5(concat_ws('||', f.engagement_hk, md5(upper(trim(x.name))))),
       f.engagement_hk, md5(upper(trim(x.name))), current_timestamp(), 'lda.senate.gov'
FROM bronze.lda_foreign_entities x JOIN silver.v_filing_keys f ON f.filing_uuid = trim(x.filing_uuid)
WHERE x.name IS NOT NULL AND trim(x.name) <> ''
  AND NOT EXISTS (SELECT 1 FROM silver.link_engagement_foreign_entity l WHERE l.engagement_foreign_entity_hk =
    md5(concat_ws('||', f.engagement_hk, md5(upper(trim(x.name))))));

-- sat_foreign_entity_filing: one row per filing and foreign entity with
-- the country, principal place of business, ownership share and
-- contribution as disclosed on that filing.
CREATE TABLE IF NOT EXISTS silver.sat_foreign_entity_filing (
  engagement_foreign_entity_hk STRING, filing_uuid STRING, country STRING, ppb_country STRING,
  ownership_percentage DECIMAL(7,2), contribution DECIMAL(14,2), load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.sat_foreign_entity_filing
SELECT s.engagement_foreign_entity_hk, s.filing_uuid, s.country, s.ppb_country, s.ownership_percentage, s.contribution,
       current_timestamp(), 'lda.senate.gov'
FROM (
  SELECT md5(concat_ws('||', f.engagement_hk, md5(upper(trim(x.name))))) AS engagement_foreign_entity_hk, f.filing_uuid,
         max(nullif(upper(trim(x.country)), '')) AS country, max(nullif(upper(trim(x.ppb_country)), '')) AS ppb_country,
         max(CAST(x.ownership_percentage AS DECIMAL(7,2))) AS ownership_percentage,
         max(CAST(x.contribution AS DECIMAL(14,2))) AS contribution
  FROM bronze.lda_foreign_entities x JOIN silver.v_filing_keys f ON f.filing_uuid = trim(x.filing_uuid)
  WHERE x.name IS NOT NULL AND trim(x.name) <> ''
  GROUP BY 1, 2) s
WHERE NOT EXISTS (SELECT 1 FROM silver.sat_foreign_entity_filing t
                  WHERE t.filing_uuid = s.filing_uuid AND t.engagement_foreign_entity_hk = s.engagement_foreign_entity_hk);

-- hub_affiliated_organization, link_engagement_affiliated_organization,
-- sat_affiliated_organization_filing: the organizations a filing says
-- contribute to or plan the client's lobbying, same shape as the foreign
-- entity objects.
CREATE TABLE IF NOT EXISTS silver.hub_affiliated_organization (
  organization_hk STRING, organization_bk STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.hub_affiliated_organization
SELECT DISTINCT md5(upper(trim(name))), upper(trim(name)), current_timestamp(), 'lda.senate.gov'
FROM bronze.lda_affiliated_organizations s
WHERE name IS NOT NULL AND trim(name) <> ''
  AND NOT EXISTS (SELECT 1 FROM silver.hub_affiliated_organization h WHERE h.organization_hk = md5(upper(trim(s.name))));

CREATE TABLE IF NOT EXISTS silver.link_engagement_affiliated_organization (
  engagement_organization_hk STRING, engagement_hk STRING, organization_hk STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.link_engagement_affiliated_organization
SELECT DISTINCT md5(concat_ws('||', f.engagement_hk, md5(upper(trim(x.name))))),
       f.engagement_hk, md5(upper(trim(x.name))), current_timestamp(), 'lda.senate.gov'
FROM bronze.lda_affiliated_organizations x JOIN silver.v_filing_keys f ON f.filing_uuid = trim(x.filing_uuid)
WHERE x.name IS NOT NULL AND trim(x.name) <> ''
  AND NOT EXISTS (SELECT 1 FROM silver.link_engagement_affiliated_organization l WHERE l.engagement_organization_hk =
    md5(concat_ws('||', f.engagement_hk, md5(upper(trim(x.name))))));

CREATE TABLE IF NOT EXISTS silver.sat_affiliated_organization_filing (
  engagement_organization_hk STRING, filing_uuid STRING, name STRING, country STRING, ppb_country STRING,
  load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.sat_affiliated_organization_filing
SELECT s.engagement_organization_hk, s.filing_uuid, s.name, s.country, s.ppb_country, current_timestamp(), 'lda.senate.gov'
FROM (
  SELECT md5(concat_ws('||', f.engagement_hk, md5(upper(trim(x.name))))) AS engagement_organization_hk, f.filing_uuid,
         max(trim(x.name)) AS name, max(nullif(upper(trim(x.country)), '')) AS country,
         max(nullif(upper(trim(x.ppb_country)), '')) AS ppb_country
  FROM bronze.lda_affiliated_organizations x JOIN silver.v_filing_keys f ON f.filing_uuid = trim(x.filing_uuid)
  WHERE x.name IS NOT NULL AND trim(x.name) <> ''
  GROUP BY 1, 2) s
WHERE NOT EXISTS (SELECT 1 FROM silver.sat_affiliated_organization_filing t
                  WHERE t.filing_uuid = s.filing_uuid AND t.engagement_organization_hk = s.engagement_organization_hk);

-- hub_legislator / sat_legislator_profile: every current and historical
-- member of Congress from the unitedstates project, keyed by bioguide id.
-- The profile keeps the name parts the revolving-door match reads, the
-- chamber (type is sen or rep), state, party, district and senate class
-- as delivered, and is_current.
CREATE TABLE IF NOT EXISTS silver.hub_legislator (
  legislator_hk STRING, legislator_bk STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.hub_legislator
SELECT DISTINCT md5(upper(trim(bioguide_id))), upper(trim(bioguide_id)), current_timestamp(), 'unitedstates/congress-legislators'
FROM bronze.ref_legislators s
WHERE bioguide_id IS NOT NULL AND trim(bioguide_id) <> ''
  AND NOT EXISTS (SELECT 1 FROM silver.hub_legislator h WHERE h.legislator_hk = md5(upper(trim(s.bioguide_id))));

CREATE TABLE IF NOT EXISTS silver.sat_legislator_profile (
  legislator_hk STRING, hash_diff STRING, full_name STRING, last_name STRING, first_name STRING, nickname STRING,
  type STRING, state STRING, district STRING, senate_class STRING, party STRING, is_current BOOLEAN,
  load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.sat_legislator_profile
SELECT legislator_hk, hash_diff, full_name, last_name, first_name, nickname, type, state, district, senate_class, party,
       is_current, current_timestamp(), 'unitedstates/congress-legislators'
FROM (
  SELECT DISTINCT md5(upper(trim(bioguide_id))) AS legislator_hk,
         trim(full_name) AS full_name, trim(last_name) AS last_name, trim(first_name) AS first_name,
         nullif(trim(nickname), '') AS nickname, lower(trim(type)) AS type, upper(trim(state)) AS state,
         nullif(trim(district), '') AS district, nullif(trim(senate_class), '') AS senate_class, trim(party) AS party,
         is_current,
         md5(concat_ws('||', trim(full_name), trim(last_name), trim(first_name), coalesce(trim(nickname), ''),
                       lower(trim(type)), upper(trim(state)), coalesce(trim(district), ''),
                       coalesce(trim(senate_class), ''), coalesce(trim(party), ''), CAST(is_current AS STRING))) AS hash_diff
  FROM bronze.ref_legislators
  WHERE bioguide_id IS NOT NULL AND trim(bioguide_id) <> '') s
WHERE NOT EXISTS (SELECT 1 FROM silver.sat_legislator_profile t WHERE t.legislator_hk = s.legislator_hk AND t.hash_diff = s.hash_diff);

-- hub_committee / sat_committee_profile: congressional committees and
-- subcommittees keyed by thomas id (HSWM is House Ways and Means).
CREATE TABLE IF NOT EXISTS silver.hub_committee (
  committee_hk STRING, committee_bk STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.hub_committee
SELECT DISTINCT md5(upper(trim(thomas_id))), upper(trim(thomas_id)), current_timestamp(), 'unitedstates/congress-legislators'
FROM bronze.ref_committees s
WHERE thomas_id IS NOT NULL AND trim(thomas_id) <> ''
  AND NOT EXISTS (SELECT 1 FROM silver.hub_committee h WHERE h.committee_hk = md5(upper(trim(s.thomas_id))));

CREATE TABLE IF NOT EXISTS silver.sat_committee_profile (
  committee_hk STRING, hash_diff STRING, name STRING, chamber STRING, parent_id STRING,
  load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.sat_committee_profile
SELECT committee_hk, hash_diff, name, chamber, parent_id, current_timestamp(), 'unitedstates/congress-legislators'
FROM (
  SELECT DISTINCT md5(upper(trim(thomas_id))) AS committee_hk, trim(name) AS name, lower(trim(chamber)) AS chamber,
         nullif(upper(trim(parent_id)), '') AS parent_id,
         md5(concat_ws('||', trim(name), lower(trim(chamber)), coalesce(upper(trim(parent_id)), ''))) AS hash_diff
  FROM bronze.ref_committees
  WHERE thomas_id IS NOT NULL AND trim(thomas_id) <> '') s
WHERE NOT EXISTS (SELECT 1 FROM silver.sat_committee_profile t WHERE t.committee_hk = s.committee_hk AND t.hash_diff = s.hash_diff);

-- hub_bill: one row per bill the Congress.gov pull returned, keyed by
-- congress and the normalized bill key (118, HR1). Both parts are kept
-- as columns so Gold can join on them without unpacking the business key.
CREATE TABLE IF NOT EXISTS silver.hub_bill (
  bill_hk STRING, bill_bk STRING, congress INT, bill_key STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.hub_bill
SELECT DISTINCT md5(concat_ws('||', trim(congress), upper(trim(bill_key)))),
       concat_ws('||', trim(congress), upper(trim(bill_key))), CAST(trim(congress) AS INT), upper(trim(bill_key)),
       current_timestamp(), 'api.congress.gov'
FROM bronze.congress_bills s
WHERE congress IS NOT NULL AND bill_key IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM silver.hub_bill h WHERE h.bill_hk = md5(concat_ws('||', trim(s.congress), upper(trim(s.bill_key)))));

-- sat_bill_detail: title, sponsor, policy area and latest action as
-- Congress.gov reports them, a new row only when something changes.
CREATE TABLE IF NOT EXISTS silver.sat_bill_detail (
  bill_hk STRING, hash_diff STRING, title STRING, policy_area STRING, sponsor_bioguide_id STRING, sponsor_name STRING,
  sponsor_party STRING, sponsor_state STRING, introduced_date DATE, latest_action_date DATE, latest_action_text STRING,
  is_law BOOLEAN, congress_url STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.sat_bill_detail
SELECT bill_hk, hash_diff, title, policy_area, sponsor_bioguide_id, sponsor_name, sponsor_party, sponsor_state,
       introduced_date, latest_action_date, latest_action_text, is_law, congress_url, current_timestamp(), 'api.congress.gov'
FROM (
  SELECT DISTINCT md5(concat_ws('||', trim(congress), upper(trim(bill_key)))) AS bill_hk,
         trim(title) AS title, nullif(trim(policy_area), '') AS policy_area,
         nullif(upper(trim(sponsor_bioguide_id)), '') AS sponsor_bioguide_id, nullif(trim(sponsor_name), '') AS sponsor_name,
         nullif(trim(sponsor_party), '') AS sponsor_party, nullif(upper(trim(sponsor_state)), '') AS sponsor_state,
         CAST(introduced_date AS DATE) AS introduced_date, CAST(latest_action_date AS DATE) AS latest_action_date,
         nullif(trim(latest_action_text), '') AS latest_action_text,
         coalesce(CAST(lower(trim(is_law)) AS BOOLEAN), false) AS is_law, trim(congress_url) AS congress_url,
         md5(concat_ws('||', coalesce(trim(title), ''), coalesce(trim(policy_area), ''), coalesce(upper(trim(sponsor_bioguide_id)), ''),
                       coalesce(trim(sponsor_name), ''), coalesce(trim(sponsor_party), ''), coalesce(upper(trim(sponsor_state)), ''),
                       coalesce(trim(introduced_date), ''), coalesce(trim(latest_action_date), ''),
                       coalesce(trim(latest_action_text), ''), coalesce(lower(trim(is_law)), ''), coalesce(trim(congress_url), ''))) AS hash_diff
  FROM bronze.congress_bills
  WHERE congress IS NOT NULL AND bill_key IS NOT NULL) s
WHERE NOT EXISTS (SELECT 1 FROM silver.sat_bill_detail t WHERE t.bill_hk = s.bill_hk AND t.hash_diff = s.hash_diff);

-- sat_bill_action: one row per recorded action on a bill. hash_diff is
-- the md5 of the action itself, so a reload inserts nothing.
CREATE TABLE IF NOT EXISTS silver.sat_bill_action (
  bill_hk STRING, hash_diff STRING, action_date DATE, action_code STRING, action_type STRING, source_system STRING,
  text STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.sat_bill_action
SELECT bill_hk, hash_diff, action_date, action_code, action_type, source_system, text, current_timestamp(), 'api.congress.gov'
FROM (
  SELECT DISTINCT md5(concat_ws('||', trim(congress), upper(trim(bill_key)))) AS bill_hk,
         CAST(action_date AS DATE) AS action_date, nullif(trim(action_code), '') AS action_code,
         nullif(trim(action_type), '') AS action_type, nullif(trim(source_system), '') AS source_system, trim(text) AS text,
         md5(concat_ws('||', coalesce(trim(action_date), ''), coalesce(trim(action_code), ''), coalesce(trim(action_type), ''),
                       coalesce(trim(source_system), ''), coalesce(trim(text), ''))) AS hash_diff
  FROM bronze.congress_bill_actions
  WHERE congress IS NOT NULL AND bill_key IS NOT NULL) s
WHERE NOT EXISTS (SELECT 1 FROM silver.sat_bill_action t WHERE t.bill_hk = s.bill_hk AND t.hash_diff = s.hash_diff);

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
-- foreign_entity_names lists every foreign entity the engagement has
-- named, and client_ppb_country is the client's principal place of
-- business as last reported.
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
  GROUP BY l.engagement_hk),
foreign_names AS (
  SELECT l.engagement_hk, array_join(array_sort(collect_set(h.foreign_entity_bk)), ', ') AS foreign_entity_names
  FROM silver.link_engagement_foreign_entity l
  JOIN silver.hub_foreign_entity h ON h.foreign_entity_hk = l.foreign_entity_hk
  GROUP BY l.engagement_hk),
client_ppb AS (
  SELECT client_hk, ppb_country FROM silver.sat_client_ppb
  QUALIFY row_number() OVER (PARTITION BY client_hk ORDER BY load_date DESC, hash_diff) = 1)
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
       a.ai_summary,
       fn.foreign_entity_names, cpp.ppb_country AS client_ppb_country
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
LEFT JOIN gold.engagement_ai_summary a ON a.engagement_hk = e.engagement_hk
LEFT JOIN foreign_names fn ON fn.engagement_hk = e.engagement_hk
LEFT JOIN client_ppb cpp ON cpp.client_hk = e.client_hk;

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

-- ---------------------------------------------------------------------
-- Bills with their legislative story. Rules, stated once:
--   a. The congress a mention belongs to comes from the filing year:
--      congress = (filing_year - 1789) / 2 + 1, so 2024 is the 118th and
--      2025 the 119th. That resolves H.R. 1 of one congress from the next.
--   b. A filing that mentions a bill counts once toward it, and its
--      income counts in full (rule 1); a registration counts as a mention
--      with no quarter and no income.
--   c. Milestones come from the Congress.gov actions by action code and
--      text, the earliest date for each: introduced (1000, 10000,
--      Intro-H, Intro-S, "Introduced in ..."), reported (5000, 14000,
--      H12200, H12210, "Reported ..."), passed_house (8000, H37300,
--      H37100, H38310, "Passed/agreed to in House", "On passage Passed",
--      "On motion to suspend the rules and pass ... Agreed to"),
--      passed_senate (17000, "Passed/agreed to in Senate", "Passed
--      Senate"), to_president (28000, E30000, "Presented to President"),
--      became_law (36000, E40000, "Became Public Law").
--   d. stage reads the milestones: law when it became law (or Congress.gov
--      says is_law), passed both when both chambers passed it, passed one
--      chamber, in committee when a committee reported it, else introduced.
-- ---------------------------------------------------------------------

-- bill_mention: filing_bill with the congress, the income and the client
-- and firm attached, one row per filing, issue code and bill.
CREATE OR REPLACE TABLE gold.bill_mention AS
WITH filing_year AS (
  SELECT filing_uuid, max(filing_year) AS filing_year FROM silver.sat_engagement_filing GROUP BY filing_uuid)
SELECT CAST(floor((y.filing_year - 1789) / 2) + 1 AS INT) AS congress,
       fb.bill_key, fb.bill_label, fb.filing_uuid, fb.engagement_hk, fb.issue_code, fb.period_end_date,
       CAST(coalesce(f.income, 0) AS DECIMAL(14,2)) AS income
FROM gold.filing_bill fb
JOIN filing_year y ON y.filing_uuid = fb.filing_uuid
LEFT JOIN gold.fact_filing f ON f.filing_uuid = fb.filing_uuid;

-- bill_congress: one row per congress and bill cited anywhere in the
-- issue text. ingest/pull_bills.py reads this for the keys to fetch.
CREATE OR REPLACE TABLE gold.bill_congress AS
SELECT congress, bill_key, max(bill_label) AS bill_label,
       CAST(count(DISTINCT engagement_hk) AS INT) AS engagement_count,
       CAST(count(DISTINCT filing_uuid) AS INT) AS filings_mentioning,
       CAST(sum(income) AS DECIMAL(14,2)) AS income
FROM (SELECT DISTINCT congress, bill_key, bill_label, engagement_hk, filing_uuid, income FROM gold.bill_mention)
GROUP BY congress, bill_key;

-- bill_milestone: one row per bill and milestone reached, earliest date.
CREATE OR REPLACE TABLE gold.bill_milestone AS
SELECT h.congress, h.bill_key, t.milestone, min(a.action_date) AS milestone_date
FROM silver.sat_bill_action a
JOIN silver.hub_bill h ON h.bill_hk = a.bill_hk
JOIN LATERAL (SELECT
  CASE WHEN a.action_code IN ('1000', '10000', 'Intro-H', 'Intro-S') OR a.text RLIKE '^Introduced in (the )?(House|Senate)' THEN 'introduced'
       WHEN a.action_code IN ('5000', '14000', 'H12200', 'H12210') OR a.text RLIKE '^(Reported (by|to|\\()|Committee on [^.]*\\. Reported)' THEN 'reported'
       WHEN a.action_code IN ('8000', 'H37300', 'H37100', 'H38310')
            OR a.text RLIKE '^(Passed/agreed to in House|On passage Passed|On motion to suspend the rules and pass.*Agreed to|Passed House)' THEN 'passed_house'
       WHEN a.action_code = '17000' OR a.text RLIKE '^(Passed/agreed to in Senate|Passed Senate)' THEN 'passed_senate'
       WHEN a.action_code IN ('28000', 'E30000') OR a.text RLIKE '^Presented to President' THEN 'to_president'
       WHEN a.action_code IN ('36000', 'E40000') OR a.text RLIKE '^Became Public Law' THEN 'became_law' END AS milestone) t
WHERE t.milestone IS NOT NULL AND a.action_date IS NOT NULL
GROUP BY h.congress, h.bill_key, t.milestone;

-- bill_detail: the Congress.gov record of a bill with the lobbying totals
-- and the stage it reached. Only bills the pull returned have a row.
CREATE OR REPLACE TABLE gold.bill_detail AS
WITH detail AS (
  SELECT * FROM silver.sat_bill_detail
  QUALIFY row_number() OVER (PARTITION BY bill_hk ORDER BY load_date DESC, hash_diff) = 1),
reached AS (
  SELECT congress, bill_key,
         max(CASE WHEN milestone = 'reported' THEN milestone_date END) AS reported,
         max(CASE WHEN milestone = 'passed_house' THEN milestone_date END) AS passed_house,
         max(CASE WHEN milestone = 'passed_senate' THEN milestone_date END) AS passed_senate,
         max(CASE WHEN milestone = 'became_law' THEN milestone_date END) AS became_law
  FROM gold.bill_milestone GROUP BY congress, bill_key)
SELECT h.congress, h.bill_key, coalesce(b.bill_label, h.bill_key) AS bill_label,
       d.title, d.policy_area, d.sponsor_bioguide_id, d.sponsor_name, d.sponsor_party, d.sponsor_state,
       d.introduced_date, d.latest_action_date, d.latest_action_text, d.is_law, d.congress_url,
       CAST(coalesce(b.engagement_count, 0) AS INT) AS engagement_count,
       CAST(coalesce(b.filings_mentioning, 0) AS INT) AS filings_mentioning,
       CAST(coalesce(b.income, 0) AS DECIMAL(14,2)) AS income,
       CASE WHEN d.is_law OR r.became_law IS NOT NULL THEN 'law'
            WHEN r.passed_house IS NOT NULL AND r.passed_senate IS NOT NULL THEN 'passed both'
            WHEN r.passed_house IS NOT NULL OR r.passed_senate IS NOT NULL THEN 'passed one chamber'
            WHEN r.reported IS NOT NULL THEN 'in committee'
            ELSE 'introduced' END AS stage
FROM silver.hub_bill h
JOIN detail d ON d.bill_hk = h.bill_hk
LEFT JOIN gold.bill_congress b ON b.congress = h.congress AND b.bill_key = h.bill_key
LEFT JOIN reached r ON r.congress = h.congress AND r.bill_key = h.bill_key;

-- bill_quarter: mentions and income by bill and quarter.
CREATE OR REPLACE TABLE gold.bill_quarter AS
SELECT congress, bill_key, period_end_date,
       CAST(count(DISTINCT filing_uuid) AS INT) AS filings_mentioning,
       CAST(count(DISTINCT engagement_hk) AS INT) AS engagement_count,
       CAST(sum(income) AS DECIMAL(14,2)) AS income
FROM (SELECT DISTINCT congress, bill_key, engagement_hk, filing_uuid, period_end_date, income FROM gold.bill_mention)
WHERE period_end_date IS NOT NULL
GROUP BY congress, bill_key, period_end_date;

-- bill_engagement: one row per bill and engagement that lobbied on it.
CREATE OR REPLACE TABLE gold.bill_engagement AS
SELECT m.congress, m.bill_key, m.engagement_hk, g.client_id, g.client, g.registrant_id, g.firm,
       min(m.period_end_date) AS first_period, max(m.period_end_date) AS last_period,
       CAST(count(DISTINCT m.filing_uuid) AS INT) AS filings_mentioning
FROM gold.bill_mention m
JOIN gold.engagement g ON g.engagement_hk = m.engagement_hk
GROUP BY m.congress, m.bill_key, m.engagement_hk, g.client_id, g.client, g.registrant_id, g.firm;

-- client: one row per client with the firms it hired and its totals.
-- organization_hk and organization_name attach the organization behind
-- the client record (link_client_organization); the organization's
-- display name is the name of its highest-income client record.
CREATE OR REPLACE TABLE gold.client AS
WITH profile AS (
  SELECT client_hk, name, general_description, state FROM silver.sat_client_profile
  QUALIFY row_number() OVER (PARTITION BY client_hk ORDER BY load_date DESC, hash_diff) = 1),
org_link AS (
  SELECT client_hk, organization_hk FROM silver.link_client_organization
  QUALIFY row_number() OVER (PARTITION BY client_hk ORDER BY load_date DESC, organization_hk) = 1),
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
  GROUP BY e.client_hk),
org_name AS (
  SELECT o.organization_hk, max_by(p.name, struct(coalesce(eng.total_income, 0), p.name)) AS organization_name
  FROM org_link o
  JOIN profile p ON p.client_hk = o.client_hk
  LEFT JOIN eng ON eng.client_hk = o.client_hk
  GROUP BY o.organization_hk)
SELECT hc.client_bk AS client_id, p.name, p.general_description AS description, p.state,
       CAST(coalesce(eng.firm_count, 0) AS INT) AS firm_count, eng.firms,
       CAST(coalesce(eng.total_income, 0) AS DECIMAL(14,2)) AS total_income,
       CAST(coalesce(quarters.quarters_active, 0) AS INT) AS quarters_active,
       issues.issue_codes,
       CAST(coalesce(people.lobbyist_count, 0) AS INT) AS lobbyist_count,
       CAST(coalesce(eng.engagement_count, 0) AS INT) AS engagement_count,
       o.organization_hk, n.organization_name
FROM silver.hub_client hc
LEFT JOIN profile p ON p.client_hk = hc.client_hk
LEFT JOIN eng ON eng.client_hk = hc.client_hk
LEFT JOIN quarters ON quarters.client_hk = hc.client_hk
LEFT JOIN issues ON issues.client_hk = hc.client_hk
LEFT JOIN people ON people.client_hk = hc.client_hk
LEFT JOIN org_link o ON o.client_hk = hc.client_hk
LEFT JOIN org_name n ON n.organization_hk = o.organization_hk;

-- client_quarter: income reported on a client's filings by quarter.
CREATE OR REPLACE TABLE gold.client_quarter AS
SELECT hc.client_bk AS client_id, q.period_end_date,
       CAST(sum(q.income) AS DECIMAL(14,2)) AS income,
       CAST(count(DISTINCT q.engagement_hk) AS INT) AS engagement_count
FROM gold.engagement_quarter q
JOIN silver.link_engagement e ON e.engagement_hk = q.engagement_hk
JOIN silver.hub_client hc ON hc.client_hk = e.client_hk
GROUP BY hc.client_bk, q.period_end_date;

-- ---------------------------------------------------------------------
-- Organizations across firms. Rule, stated once: an organization is the
-- set of client records that share a normalized name (hub_organization),
-- so one organization hired by three firms is one organization with three
-- client rows. Its totals are the sums over those client records; a
-- quarterly report counts once (rule 1 does not apply, each report
-- belongs to one client record).
-- ---------------------------------------------------------------------

-- organization_quarter: income by organization and quarter.
CREATE OR REPLACE TABLE gold.organization_quarter AS
SELECT c.organization_hk, q.period_end_date,
       CAST(sum(q.income) AS DECIMAL(14,2)) AS income,
       CAST(count(DISTINCT q.engagement_hk) AS INT) AS engagement_count,
       CAST(count(DISTINCT e.client_hk) AS INT) AS client_count,
       CAST(count(DISTINCT e.registrant_hk) AS INT) AS firm_count
FROM gold.engagement_quarter q
JOIN silver.link_engagement e ON e.engagement_hk = q.engagement_hk
JOIN silver.hub_client hc ON hc.client_hk = e.client_hk
JOIN gold.client c ON c.client_id = hc.client_bk
WHERE c.organization_hk IS NOT NULL
GROUP BY c.organization_hk, q.period_end_date;

-- organization: one row per organization with its client records, firms
-- and totals.
CREATE OR REPLACE TABLE gold.organization AS
WITH member AS (
  SELECT c.organization_hk, c.organization_name, c.client_id, hc.client_hk, c.total_income, c.issue_codes
  FROM gold.client c
  JOIN silver.hub_client hc ON hc.client_bk = c.client_id
  WHERE c.organization_hk IS NOT NULL),
eng AS (
  SELECT m.organization_hk, count(*) AS engagement_count, count(DISTINCT e.registrant_hk) AS firm_count,
         min(g.first_period) AS first_period, max(g.last_period) AS last_period
  FROM member m
  JOIN silver.link_engagement e ON e.client_hk = m.client_hk
  JOIN gold.engagement g ON g.engagement_hk = e.engagement_hk
  GROUP BY m.organization_hk),
quarters AS (
  SELECT organization_hk, count(*) AS quarters_active FROM gold.organization_quarter GROUP BY organization_hk),
issues AS (
  SELECT m.organization_hk, array_join(array_sort(collect_set(x.issue_code)), ', ') AS issue_codes
  FROM member m
  LATERAL VIEW explode(split(m.issue_codes, ', ')) x AS issue_code
  WHERE m.issue_codes IS NOT NULL
  GROUP BY m.organization_hk)
SELECT m.organization_hk, max(m.organization_name) AS organization_name,
       CAST(count(*) AS INT) AS client_count,
       CAST(coalesce(max(eng.firm_count), 0) AS INT) AS firm_count,
       CAST(coalesce(max(eng.engagement_count), 0) AS INT) AS engagement_count,
       CAST(sum(m.total_income) AS DECIMAL(14,2)) AS total_income,
       CAST(coalesce(max(quarters.quarters_active), 0) AS INT) AS quarters_active,
       max(issues.issue_codes) AS issue_codes,
       max(eng.first_period) AS first_period, max(eng.last_period) AS last_period
FROM member m
LEFT JOIN eng ON eng.organization_hk = m.organization_hk
LEFT JOIN quarters ON quarters.organization_hk = m.organization_hk
LEFT JOIN issues ON issues.organization_hk = m.organization_hk
GROUP BY m.organization_hk;

-- organization_firm: one row per organization and firm it registered
-- with. client_id and client are the client record that firm reported
-- the most income for; rank is 1 for the firm with the most income.
CREATE OR REPLACE TABLE gold.organization_firm AS
SELECT organization_hk, registrant_id, firm, client_id, client, engagement_count, total_income, first_period, last_period,
       CAST(row_number() OVER (PARTITION BY organization_hk ORDER BY total_income DESC, firm, registrant_id) AS INT) AS rank
FROM (
  SELECT c.organization_hk, g.registrant_id, g.firm,
         max_by(g.client_id, struct(g.total_income, g.client_id)) AS client_id,
         max_by(g.client, struct(g.total_income, g.client_id)) AS client,
         CAST(count(*) AS INT) AS engagement_count,
         CAST(sum(g.total_income) AS DECIMAL(14,2)) AS total_income,
         min(g.first_period) AS first_period, max(g.last_period) AS last_period
  FROM gold.engagement g
  JOIN gold.client c ON c.client_id = g.client_id
  WHERE c.organization_hk IS NOT NULL
  GROUP BY c.organization_hk, g.registrant_id, g.firm);

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

-- ---------------------------------------------------------------------
-- Keyword trends. Rules, stated once:
--   a. The searchable text is the specific-issues text of the winning
--      version of each quarterly report (rule 3), lower-cased. One row per
--      filing and issue code.
--   b. A term matches a filing when the lower-cased text of any of its
--      issue codes contains the term (LIKE '%term%'), so "tariff" also
--      matches "tariffs".
--   c. A filing that mentions a term counts once toward that term however
--      many issue codes mention it, and its income counts in full (rule 1).
-- ---------------------------------------------------------------------

-- activity_text: the live-search table. Any phrase the curated list does
-- not cover is charted by querying this table directly.
CREATE OR REPLACE TABLE gold.activity_text AS
SELECT f.filing_uuid, f.engagement_hk, f.period_end_date, t.issue_code, f.income,
       lower(t.specific_issues) AS text_lower
FROM silver.sat_engagement_issues_text t
JOIN gold.fact_filing f ON f.filing_uuid = t.filing_uuid
WHERE t.specific_issues IS NOT NULL AND trim(t.specific_issues) <> ''
QUALIFY row_number() OVER (PARTITION BY t.filing_uuid, t.issue_code ORDER BY t.load_date DESC, t.hash_diff) = 1;

-- curated_term: the curated list, stated here only. term carries one row
-- per curated term whether or not any filing mentions it, so a tile on
-- /trends renders for every term.
CREATE OR REPLACE TABLE gold.curated_term AS
SELECT term FROM VALUES
  ('artificial intelligence'), ('data center'), ('semiconductor'), ('tariff'), ('stablecoin'),
  ('cryptocurrency'), ('pfas'), ('medicare advantage'), ('drug pricing'), ('electric vehicle'),
  ('nuclear'), ('lng'), ('permitting'), ('child tax credit'), ('endowment tax'),
  ('antitrust'), ('section 230'), ('tiktok'), ('drone'), ('ukraine'),
  ('israel'), ('broadband'), ('340b'), ('medicaid'), ('farm bill'),
  ('highway'), ('housing'), ('tax credit'), ('one big beautiful bill'), ('ndaa') AS t(term);

-- term_hit: the curated terms matched against activity_text, one row per
-- term, filing and issue code.
CREATE OR REPLACE TABLE gold.term_hit AS
SELECT c.term, a.filing_uuid, a.engagement_hk, a.period_end_date, a.issue_code, a.income
FROM gold.activity_text a
JOIN gold.curated_term c ON a.text_lower LIKE concat('%', c.term, '%');

-- term: one row per curated term; zeros and null periods when nothing
-- mentions it yet.
CREATE OR REPLACE TABLE gold.term AS
WITH hit AS (
  SELECT term,
         count(*) AS filings_mentioning,
         count(DISTINCT engagement_hk) AS engagement_count,
         sum(income) AS income,
         min(period_end_date) AS first_period, max(period_end_date) AS last_period
  FROM (SELECT term, filing_uuid, engagement_hk, period_end_date, max(income) AS income
        FROM gold.term_hit GROUP BY term, filing_uuid, engagement_hk, period_end_date)
  GROUP BY term)
SELECT c.term,
       CAST(coalesce(h.filings_mentioning, 0) AS INT) AS filings_mentioning,
       CAST(coalesce(h.engagement_count, 0) AS INT) AS engagement_count,
       CAST(coalesce(h.income, 0) AS DECIMAL(14,2)) AS income,
       h.first_period, h.last_period
FROM gold.curated_term c
LEFT JOIN hit h ON h.term = c.term;

-- term_quarter: mentions and income by term and quarter. Sums to term.
CREATE OR REPLACE TABLE gold.term_quarter AS
SELECT term, period_end_date,
       CAST(count(*) AS INT) AS filings_mentioning,
       CAST(count(DISTINCT engagement_hk) AS INT) AS engagement_count,
       CAST(sum(income) AS DECIMAL(14,2)) AS income
FROM (SELECT term, filing_uuid, engagement_hk, period_end_date, max(income) AS income
      FROM gold.term_hit GROUP BY term, filing_uuid, engagement_hk, period_end_date)
GROUP BY term, period_end_date;

-- term_client: clients ranked by income within a term.
CREATE OR REPLACE TABLE gold.term_client AS
SELECT term, client_id, client, filings_mentioning, income,
       CAST(row_number() OVER (PARTITION BY term ORDER BY income DESC, filings_mentioning DESC, client, client_id) AS INT) AS rank
FROM (
  SELECT h.term, g.client_id, g.client,
         CAST(count(*) AS INT) AS filings_mentioning, CAST(sum(h.income) AS DECIMAL(14,2)) AS income
  FROM (SELECT term, filing_uuid, engagement_hk, max(income) AS income
        FROM gold.term_hit GROUP BY term, filing_uuid, engagement_hk) h
  JOIN gold.engagement g ON g.engagement_hk = h.engagement_hk
  GROUP BY h.term, g.client_id, g.client);

-- term_issue: which issue codes the mentions fall under.
CREATE OR REPLACE TABLE gold.term_issue AS
SELECT term, issue_code, CAST(count(DISTINCT filing_uuid) AS INT) AS filings_mentioning
FROM gold.term_hit
GROUP BY term, issue_code;

-- ---------------------------------------------------------------------
-- Who gets lobbied. Rules, stated once:
--   a. A filing's income counts in full toward every government entity it
--      lists (rule 1), and once per entity however many issue codes list
--      the entity on that filing.
--   b. Only quarterly reports carry contacts into quarters and income;
--      engagement, client and firm counts come from every filing,
--      registrations included.
--   c. chamber_or_agency reads the entity name: White House for the
--      White House, the Executive Office of the President and the Office
--      of the Vice President; House for the House of Representatives;
--      Senate for the Senate; Agency for everything else.
-- ---------------------------------------------------------------------

-- government_entity_contact: one row per entity, filing and issue code
-- on a quarterly report. Feeds the four government entity marts.
CREATE OR REPLACE TABLE gold.government_entity_contact AS
SELECT DISTINCT l.entity_hk, l.engagement_hk, l.issue_code, f.filing_uuid, f.period_end_date, f.income
FROM silver.sat_engagement_government_entity_filing s
JOIN silver.link_engagement_government_entity l ON l.engagement_entity_hk = s.engagement_entity_hk
JOIN gold.fact_filing f ON f.filing_uuid = s.filing_uuid;

-- government_entity: one row per agency or chamber ever listed as contacted.
CREATE OR REPLACE TABLE gold.government_entity AS
WITH linked AS (
  SELECT l.entity_hk, count(DISTINCT l.engagement_hk) AS engagement_count,
         count(DISTINCT e.client_hk) AS client_count, count(DISTINCT e.registrant_hk) AS firm_count
  FROM silver.link_engagement_government_entity l
  JOIN silver.link_engagement e ON e.engagement_hk = l.engagement_hk
  GROUP BY l.entity_hk),
reported AS (
  SELECT entity_hk, sum(income) AS income
  FROM (SELECT DISTINCT entity_hk, filing_uuid, income FROM gold.government_entity_contact)
  GROUP BY entity_hk)
SELECT h.entity_hk, h.entity_bk AS entity_name,
       CAST(coalesce(l.engagement_count, 0) AS INT) AS engagement_count,
       CAST(coalesce(l.client_count, 0) AS INT) AS client_count,
       CAST(coalesce(l.firm_count, 0) AS INT) AS firm_count,
       CAST(coalesce(r.income, 0) AS DECIMAL(14,2)) AS income,
       CAST(row_number() OVER (ORDER BY coalesce(r.income, 0) DESC, coalesce(l.engagement_count, 0) DESC, h.entity_bk) AS INT) AS rank,
       CASE WHEN h.entity_bk LIKE '%WHITE HOUSE%' OR h.entity_bk LIKE '%EXECUTIVE OFFICE OF THE PRESIDENT%'
                 OR h.entity_bk LIKE '%OFFICE OF THE VICE PRESIDENT%' THEN 'White House'
            WHEN h.entity_bk LIKE '%HOUSE OF REPRESENTATIVES%' THEN 'House'
            WHEN h.entity_bk LIKE '%SENATE%' THEN 'Senate'
            ELSE 'Agency' END AS chamber_or_agency
FROM silver.hub_government_entity h
LEFT JOIN linked l ON l.entity_hk = h.entity_hk
LEFT JOIN reported r ON r.entity_hk = h.entity_hk;

-- government_entity_quarter: contacts and income by entity and quarter.
CREATE OR REPLACE TABLE gold.government_entity_quarter AS
SELECT entity_hk, period_end_date,
       CAST(count(DISTINCT engagement_hk) AS INT) AS engagement_count,
       CAST(sum(income) AS DECIMAL(14,2)) AS income
FROM (SELECT DISTINCT entity_hk, engagement_hk, filing_uuid, period_end_date, income FROM gold.government_entity_contact)
GROUP BY entity_hk, period_end_date;

-- government_entity_issue: the issue codes an entity is contacted on,
-- ranked by income within the entity.
CREATE OR REPLACE TABLE gold.government_entity_issue AS
SELECT entity_hk, issue_code, engagement_count, income,
       CAST(row_number() OVER (PARTITION BY entity_hk ORDER BY income DESC, engagement_count DESC, issue_code) AS INT) AS rank
FROM (
  SELECT entity_hk, issue_code,
         CAST(count(DISTINCT engagement_hk) AS INT) AS engagement_count,
         CAST(sum(income) AS DECIMAL(14,2)) AS income
  FROM (SELECT DISTINCT entity_hk, issue_code, engagement_hk, filing_uuid, income FROM gold.government_entity_contact)
  GROUP BY entity_hk, issue_code);

-- government_entity_client: the clients behind the contacts, ranked by
-- income within the entity.
CREATE OR REPLACE TABLE gold.government_entity_client AS
SELECT entity_hk, client_id, client, income,
       CAST(row_number() OVER (PARTITION BY entity_hk ORDER BY income DESC, client, client_id) AS INT) AS rank
FROM (
  SELECT c.entity_hk, g.client_id, g.client, CAST(sum(c.income) AS DECIMAL(14,2)) AS income
  FROM (SELECT DISTINCT entity_hk, engagement_hk, filing_uuid, income FROM gold.government_entity_contact) c
  JOIN gold.engagement g ON g.engagement_hk = c.engagement_hk
  GROUP BY c.entity_hk, g.client_id, g.client);

-- ---------------------------------------------------------------------
-- Foreign-funded lobbying. Rules, stated once:
--   a. A quarterly report is foreign-linked when it names at least one
--      foreign entity, or when its client's principal place of business
--      is outside the US (ppb_country not 'US' and not null).
--   b. The country is the foreign entity's country (its principal place
--      of business when the country is blank); for a report with no
--      foreign entity it is the client's ppb_country.
--   c. A report counts once per country however many entities from that
--      country it names, and its income counts in full (rule 1).
-- ---------------------------------------------------------------------

-- foreign_filing: one row per foreign-linked quarterly report, country
-- and foreign entity (null entity when the link is the client's ppb).
CREATE OR REPLACE TABLE gold.foreign_filing AS
WITH entity_rows AS (
  SELECT f.filing_uuid, f.engagement_hk, f.period_end_date, f.income,
         coalesce(s.country, s.ppb_country) AS country, l.foreign_entity_hk, h.foreign_entity_bk AS foreign_entity_name
  FROM silver.sat_foreign_entity_filing s
  JOIN silver.link_engagement_foreign_entity l ON l.engagement_foreign_entity_hk = s.engagement_foreign_entity_hk
  JOIN silver.hub_foreign_entity h ON h.foreign_entity_hk = l.foreign_entity_hk
  JOIN gold.fact_filing f ON f.filing_uuid = s.filing_uuid
  WHERE coalesce(s.country, s.ppb_country) IS NOT NULL),
client_ppb AS (
  SELECT client_hk, ppb_country FROM silver.sat_client_ppb
  QUALIFY row_number() OVER (PARTITION BY client_hk ORDER BY load_date DESC, hash_diff) = 1),
client_rows AS (
  SELECT f.filing_uuid, f.engagement_hk, f.period_end_date, f.income,
         p.ppb_country AS country, CAST(NULL AS STRING) AS foreign_entity_hk, CAST(NULL AS STRING) AS foreign_entity_name
  FROM gold.fact_filing f
  JOIN silver.link_engagement e ON e.engagement_hk = f.engagement_hk
  JOIN client_ppb p ON p.client_hk = e.client_hk
  WHERE p.ppb_country <> 'US'
    AND NOT EXISTS (SELECT 1 FROM entity_rows x WHERE x.filing_uuid = f.filing_uuid))
SELECT * FROM entity_rows
UNION ALL
SELECT * FROM client_rows;

-- country_name: ISO code to display name from the LDA constants endpoint.
CREATE OR REPLACE TABLE gold.country_name AS
SELECT upper(trim(country_code)) AS country_code, trim(country_name) AS country_name
FROM bronze.ref_countries;

-- foreign_country: one row per country, ranked by income.
CREATE OR REPLACE TABLE gold.foreign_country AS
SELECT country,
       coalesce(n.country_name, f.country) AS country_name,
       CAST(count(DISTINCT engagement_hk) AS INT) AS engagement_count,
       CAST(count(DISTINCT client_hk) AS INT) AS client_count,
       CAST(count(DISTINCT foreign_entity_hk) AS INT) AS foreign_entity_count,
       CAST(sum(income) AS DECIMAL(14,2)) AS income,
       CAST(row_number() OVER (ORDER BY sum(income) DESC, count(DISTINCT engagement_hk) DESC, country) AS INT) AS rank
FROM (
  SELECT ff.country, ff.engagement_hk, e.client_hk, ff.foreign_entity_hk, ff.filing_uuid,
         CASE WHEN row_number() OVER (PARTITION BY ff.country, ff.filing_uuid ORDER BY ff.foreign_entity_hk) = 1
              THEN ff.income ELSE 0 END AS income
  FROM gold.foreign_filing ff
  JOIN silver.link_engagement e ON e.engagement_hk = ff.engagement_hk) f
LEFT JOIN gold.country_name n ON n.country_code = f.country
GROUP BY country, n.country_name;

-- foreign_country_quarter: income and engagements by country and quarter.
CREATE OR REPLACE TABLE gold.foreign_country_quarter AS
SELECT country, period_end_date,
       CAST(sum(income) AS DECIMAL(14,2)) AS income,
       CAST(count(DISTINCT engagement_hk) AS INT) AS engagement_count
FROM (SELECT DISTINCT country, filing_uuid, engagement_hk, period_end_date, income FROM gold.foreign_filing)
GROUP BY country, period_end_date;

-- foreign_country_client: the clients behind a country's lobbying, ranked
-- by income within the country. A client with several firms shows the
-- firm that reported the most income for it.
CREATE OR REPLACE TABLE gold.foreign_country_client AS
WITH per_engagement AS (
  SELECT ff.country, g.client_id, g.client, g.registrant_id, g.firm, sum(ff.income) AS income
  FROM (SELECT DISTINCT country, filing_uuid, engagement_hk, income FROM gold.foreign_filing) ff
  JOIN gold.engagement g ON g.engagement_hk = ff.engagement_hk
  GROUP BY ff.country, g.client_id, g.client, g.registrant_id, g.firm),
names AS (
  SELECT ff.country, g.client_id,
         nullif(array_join(array_sort(collect_set(ff.foreign_entity_name)), ', '), '') AS foreign_entity_names,
         array_join(array_sort(collect_set(x.issue_code)), ', ') AS issue_codes
  FROM gold.foreign_filing ff
  JOIN gold.engagement g ON g.engagement_hk = ff.engagement_hk
  LEFT JOIN gold.activity_text x ON x.filing_uuid = ff.filing_uuid
  GROUP BY ff.country, g.client_id)
SELECT p.country, p.client_id, max(p.client) AS client,
       max_by(p.registrant_id, p.income) AS registrant_id, max_by(p.firm, p.income) AS firm,
       CAST(sum(p.income) AS DECIMAL(14,2)) AS income,
       max(n.foreign_entity_names) AS foreign_entity_names, max(n.issue_codes) AS issue_codes,
       CAST(row_number() OVER (PARTITION BY p.country ORDER BY sum(p.income) DESC, max(p.client), p.client_id) AS INT) AS rank
FROM per_engagement p
LEFT JOIN names n ON n.country = p.country AND n.client_id = p.client_id
GROUP BY p.country, p.client_id;

-- ---------------------------------------------------------------------
-- Revolving door. Everything here is the lobbyist's own disclosure: the
-- covered position text on the filing, matched by pattern. The app shows
-- it with the label "as disclosed by the lobbyist". Rules, stated once:
--   a. A position is the distinct covered-position text, verbatim.
--   b. Committees match when the lower-cased position contains a phrase
--      from the map below. A phrase that names the committee and its
--      chamber in words, or a committee name that exists in one chamber
--      only, is 'high'; an abbreviation or a phrase that could be read
--      another way is 'medium'.
--   c. Members match the pattern (Sen|Sen.|Senator|Rep|Rep.|Representative|
--      Congressman|Congresswoman|Cong.) followed by one to three
--      capitalized words, the last being the surname, with an optional
--      "(State)" or "(D-State)". The chamber comes from the title. A
--      candidate is a distinct legislator with that surname in that
--      chamber (and that state when given). A written first name must
--      agree with the recorded first name or nickname, or be a prefix of
--      three or more letters of it ("Don" for Donald): the match is kept
--      when the first name agrees and is the only such candidate or the
--      member is current. When no first name
--      was written, the match is kept when the surname is unique in the
--      chamber or exactly one current member carries it. A surname
--      namesake never stands in for a written first name that matched
--      nobody. 'high' when the first name or the state confirmed it,
--      'medium' otherwise (the first-name case extends the addendum,
--      which names only the state). Known limit: the legislators file
--      carries a member's latest chamber only, so staff of a member who
--      later changed chambers ("Rep. Marsha Blackburn") do not match.
--   d. Agencies match when the position contains the name of an agency
--      or White House office as the LDA lists it, with any trailing
--      "(ABBR)" removed, or that abbreviation of three or more capitals
--      as a whole word. The two chambers (House, Senate) are left out:
--      nearly every Hill position names one and that is not an agency
--      affiliation. 'medium'.
--   e. lobbies_former_employer is true when the engagement contacted the
--      chamber of the committee or member (House, Senate) or the agency
--      itself, as classified in government_entity.
-- ---------------------------------------------------------------------

-- issue_committee: which standing committee of each chamber has
-- jurisdiction over each LDA general issue code, curated by hand in
-- data/reference/issue_committees.csv. Rule, stated once: the map is the
-- curated list and nothing else; every issue code has at least one House
-- and one Senate standing committee. Select and permanent committees
-- (intelligence, Indian affairs, ethics, aging, the joint committees)
-- are left out on purpose, so a lobbyist whose only disclosed committee
-- is one of those has null jurisdiction_issues and never sets
-- revolving_door.jurisdiction_match. committee_name comes from the
-- unitedstates committee reference.
CREATE OR REPLACE TABLE gold.issue_committee AS
WITH committee AS (
  SELECT hc.committee_bk AS thomas_id, p.name
  FROM silver.hub_committee hc
  JOIN silver.sat_committee_profile p ON p.committee_hk = hc.committee_hk
  QUALIFY row_number() OVER (PARTITION BY hc.committee_hk ORDER BY p.load_date DESC, p.hash_diff) = 1)
SELECT DISTINCT upper(trim(r.issue_code)) AS issue_code, lower(trim(r.chamber)) AS chamber,
       upper(trim(r.thomas_id)) AS thomas_id, c.name AS committee_name
FROM bronze.ref_issue_committees r
LEFT JOIN committee c ON c.thomas_id = upper(trim(r.thomas_id))
WHERE r.issue_code IS NOT NULL AND r.thomas_id IS NOT NULL;

-- lobbyist_position: one row per lobbyist and distinct covered position.
CREATE OR REPLACE TABLE gold.lobbyist_position AS
SELECT hl.lobbyist_bk AS lobbyist_id, trim(sf.covered_position) AS position_text,
       min(f.period_end_date) AS first_period, max(f.period_end_date) AS last_period
FROM silver.sat_engagement_lobbyist_filing sf
JOIN silver.link_engagement_lobbyist ll ON ll.engagement_lobbyist_hk = sf.engagement_lobbyist_hk
JOIN silver.hub_lobbyist hl ON hl.lobbyist_hk = ll.lobbyist_hk
LEFT JOIN gold.fact_filing f ON f.filing_uuid = sf.filing_uuid
WHERE sf.covered_position IS NOT NULL AND trim(sf.covered_position) <> ''
GROUP BY hl.lobbyist_bk, trim(sf.covered_position);

-- lobbyist_affiliation: the committees, members and agencies a lobbyist's
-- positions name, one row per lobbyist, kind and reference.
-- jurisdiction_issues lists the issue codes a committee affiliation has
-- jurisdiction over (issue_committee), sorted and joined with ', ';
-- null for a member or agency.
CREATE OR REPLACE TABLE gold.lobbyist_affiliation AS
WITH committee_phrase AS (
  SELECT thomas_id, phrase, confidence FROM VALUES
    ('HSAG', 'house agriculture', 'high'), ('HSAG', 'house committee on agriculture', 'high'), ('HSAG', 'house ag ', 'medium'),
    ('HSAP', 'house appropriation', 'high'), ('HSAP', 'house approps', 'medium'), ('HSAP', 'h approps', 'medium'),
    ('HSAS', 'house armed services', 'high'), ('HSAS', 'hasc', 'medium'),
    ('HSBA', 'financial services', 'medium'), ('HSBA', 'house banking', 'medium'),
    ('HSBU', 'house budget', 'high'),
    ('HSED', 'education and the workforce', 'high'), ('HSED', 'education and workforce', 'high'),
    ('HSED', 'education & the workforce', 'high'), ('HSED', 'education & workforce', 'high'), ('HSED', 'education and labor', 'high'),
    ('HSFA', 'foreign affairs', 'high'), ('HSFA', 'for. aff.', 'medium'), ('HSFA', 'hfac', 'medium'),
    ('HSGO', 'oversight and government reform', 'high'), ('HSGO', 'oversight and reform', 'high'),
    ('HSGO', 'oversight and accountability', 'high'), ('HSGO', 'house oversight', 'high'), ('HSGO', 'government reform', 'medium'),
    ('HSHA', 'house administration', 'high'), ('HSHA', 'h. admin', 'medium'),
    ('HSHM', 'house homeland security', 'high'), ('HSHM', 'house homeland', 'medium'),
    ('HSIF', 'energy and commerce', 'high'), ('HSIF', 'energy & commerce', 'high'), ('HSIF', 'e&c', 'medium'),
    ('HSII', 'house natural resources', 'high'), ('HSII', 'house resources', 'medium'),
    ('HLIG', 'house intelligence', 'high'), ('HLIG', 'house permanent select committee on intelligence', 'high'), ('HLIG', 'hpsci', 'medium'),
    ('HSJU', 'house judiciary', 'high'),
    ('HSPW', 'transportation and infrastructure', 'high'), ('HSPW', 'transportation & infrastructure', 'high'), ('HSPW', 't&i', 'medium'),
    ('HSRU', 'house rules', 'high'),
    ('HSSM', 'house small business', 'high'), ('HSSM', 'house small bus', 'medium'),
    ('HSSO', 'house ethics', 'high'), ('HSSO', 'standards of official conduct', 'high'),
    ('HSSY', 'science, space', 'high'), ('HSSY', 'committee on science', 'high'), ('HSSY', 'house science', 'high'),
    ('HSSY', 'science committee', 'medium'),
    ('HSVR', 'house veterans', 'high'), ('HSVR', 'house committee on veterans', 'high'), ('HSVR', 'house vet affairs', 'medium'),
    ('HSWM', 'ways and means', 'high'), ('HSWM', 'ways & means', 'high'), ('HSWM', 'w&m', 'medium'), ('HSWM', 'ways means', 'medium'),
    ('SSAF', 'senate agriculture', 'high'), ('SSAF', 'agriculture, nutrition', 'high'), ('SSAF', 'sen ag ', 'medium'), ('SSAF', 'senate ag ', 'medium'),
    ('SSAP', 'senate appropriation', 'high'), ('SSAP', 'sen. appropriation', 'high'), ('SSAP', 'sen appropriation', 'high'),
    ('SSAP', 'senate approps', 'medium'), ('SSAP', 'sen approps', 'medium'),
    ('SSAS', 'senate armed services', 'high'), ('SSAS', 'sen armed services', 'high'), ('SSAS', 'sasc', 'medium'),
    ('SSBK', 'senate banking', 'high'), ('SSBK', 'sen. banking', 'high'), ('SSBK', 'banking, housing', 'high'), ('SSBK', 'sen banking', 'medium'),
    ('SSBU', 'senate budget', 'high'), ('SSBU', 'sen budget', 'medium'),
    ('SSCM', 'senate commerce', 'high'), ('SSCM', 'sen. commerce', 'high'), ('SSCM', 'commerce, science', 'high'), ('SSCM', 'sen commerce', 'medium'),
    ('SSEG', 'energy and natural resources', 'high'), ('SSEG', 'energy & natural resources', 'high'),
    ('SSEG', 'senate energy', 'high'), ('SSEG', 'sen energy', 'medium'),
    ('SSEV', 'environment and public works', 'high'), ('SSEV', 'environment & public works', 'high'), ('SSEV', 'epw', 'medium'),
    ('SSFI', 'senate finance', 'high'), ('SSFI', 'sen. finance', 'high'), ('SSFI', 'sen finance', 'high'),
    ('SSFI', 'sen. fin.', 'medium'), ('SSFI', 'sen fin', 'medium'), ('SSFI', 'senate fin.', 'medium'), ('SSFI', 'finance committee', 'medium'),
    ('SSFR', 'foreign relations', 'high'), ('SSFR', 'sfrc', 'medium'),
    ('SSGA', 'homeland security and governmental affairs', 'high'), ('SSGA', 'homeland security & governmental affairs', 'high'),
    ('SSGA', 'senate governmental affairs', 'high'), ('SSGA', ' governmental affairs committee', 'medium'), ('SSGA', 'hsgac', 'medium'),
    ('SSHR', 'health, education, labor', 'high'), ('SSHR', 'help committee', 'high'), ('SSHR', 'senate help', 'high'),
    ('SSHR', 'sen help', 'medium'), ('SSHR', 'sen hlth', 'medium'),
    ('SSJU', 'senate judiciary', 'high'), ('SSJU', 'sen. judiciary', 'high'), ('SSJU', 'sen judiciary', 'high'), ('SSJU', 'sen jud', 'medium'),
    ('SSRA', 'senate rules', 'high'), ('SSRA', 'rules and administration', 'high'),
    ('SSSB', 'senate small business', 'high'), ('SSSB', 'small business and entrepreneurship', 'high'), ('SSSB', 'sen small bus', 'medium'),
    ('SSVA', 'senate veterans', 'high'), ('SSVA', 'senate committee on veterans', 'high'),
    ('SSVA', 'senate vet affairs', 'medium'), ('SSVA', 'sen vet', 'medium'),
    ('SLIA', 'committee on indian affairs', 'high'), ('SLIA', 'senate indian affairs', 'high'),
    ('SLIN', 'senate intelligence', 'high'), ('SLIN', 'senate select committee on intelligence', 'high'), ('SLIN', 'ssci', 'medium'),
    ('SPAG', 'special committee on aging', 'high'), ('SPAG', 'senate aging', 'high'), ('SPAG', 'aging committee', 'medium'),
    ('SLET', 'senate ethics', 'high'), ('SLET', 'select committee on ethics', 'high'),
    ('JSTX', 'joint committee on taxation', 'high'), ('JSTX', 'joint tax', 'medium'), ('JSTX', 'jct', 'medium'),
    ('JSEC', 'joint economic', 'high')
  AS t(thomas_id, phrase, confidence)),
committee AS (
  SELECT hc.committee_bk AS thomas_id, p.name, p.chamber
  FROM silver.hub_committee hc
  JOIN silver.sat_committee_profile p ON p.committee_hk = hc.committee_hk
  QUALIFY row_number() OVER (PARTITION BY hc.committee_hk ORDER BY p.load_date DESC, p.hash_diff) = 1),
committees AS (
  SELECT lp.lobbyist_id, 'committee' AS kind, c.thomas_id AS ref_id, c.name AS ref_name,
         ph.phrase AS matched_text, ph.confidence
  FROM gold.lobbyist_position lp
  JOIN committee_phrase ph ON lower(lp.position_text) LIKE concat('%', ph.phrase, '%')
  JOIN committee c ON c.thomas_id = ph.thomas_id),
mention AS (
  SELECT lp.lobbyist_id, m AS matched_text,
         CASE WHEN m RLIKE '^(Sen\\.?\\s|Senator)' THEN 'sen' ELSE 'rep' END AS chamber,
         regexp_extract(m, '^(?:Sen\\.?|Senator|Rep\\.?|Representative|Congressman|Congresswoman|Cong\\.)\\s+((?:[A-Z][A-Za-z''\\-\\.]*\\s+){0,2}[A-Z][A-Za-z''\\-]+)', 1) AS name_words,
         nullif(regexp_extract(m, '\\((?:[DRI]-)?([A-Z]{2})', 1), '') AS state
  FROM gold.lobbyist_position lp
  LATERAL VIEW explode(regexp_extract_all(lp.position_text,
    '(?:Sen\\.?|Senator|Rep\\.?|Representative|Congressman|Congresswoman|Cong\\.)\\s+(?:[A-Z][A-Za-z''\\-\\.]*\\s+){0,2}[A-Z][A-Za-z''\\-]+(?:\\s*\\((?:[DRI]-)?[A-Z]{2}(?:-\\d{1,2})?\\))?', 0)) x AS m),
parsed AS (
  SELECT lobbyist_id, matched_text, chamber, state,
         lower(element_at(split(trim(name_words), '\\s+'), -1)) AS last_word,
         CASE WHEN size(split(trim(name_words), '\\s+')) > 1
              THEN lower(regexp_replace(element_at(split(trim(name_words), '\\s+'), 1), '\\.', '')) END AS first_word
  FROM mention WHERE name_words <> ''),
legislator AS (
  SELECT h.legislator_bk AS bioguide_id, coalesce(nullif(p.full_name, ''), concat_ws(' ', p.first_name, p.last_name)) AS full_name,
         lower(p.last_name) AS last_name, lower(p.first_name) AS first_name,
         lower(p.nickname) AS nickname, p.type, p.state, p.is_current
  FROM silver.hub_legislator h
  JOIN silver.sat_legislator_profile p ON p.legislator_hk = h.legislator_hk
  QUALIFY row_number() OVER (PARTITION BY h.legislator_hk ORDER BY p.load_date DESC, p.hash_diff) = 1),
candidate AS (
  SELECT DISTINCT m.lobbyist_id, m.matched_text, m.first_word, l.bioguide_id, l.full_name, l.is_current,
         coalesce(m.first_word = l.first_name OR m.first_word = l.nickname
                  OR (length(m.first_word) >= 3 AND l.first_name LIKE concat(m.first_word, '%')), false) AS first_match,
         m.state IS NOT NULL AS state_match
  FROM parsed m
  JOIN legislator l ON l.last_name = m.last_word AND l.type = m.chamber AND (m.state IS NULL OR l.state = m.state)),
scored AS (
  SELECT *, count(*) OVER w AS n_candidates,
         sum(CASE WHEN first_match THEN 1 ELSE 0 END) OVER w AS n_first,
         sum(CASE WHEN is_current THEN 1 ELSE 0 END) OVER w AS n_current
  FROM candidate
  WINDOW w AS (PARTITION BY lobbyist_id, matched_text)),
members AS (
  SELECT lobbyist_id, 'member' AS kind, bioguide_id AS ref_id, full_name AS ref_name, matched_text,
         CASE WHEN first_match OR state_match THEN 'high' ELSE 'medium' END AS confidence
  FROM scored
  WHERE (first_match AND (n_first = 1 OR is_current))
     OR (first_word IS NULL AND (n_candidates = 1 OR (is_current AND n_current = 1)))),
agency AS (
  SELECT entity_hk, entity_name,
         trim(regexp_replace(entity_name, '\\s*\\([^)]*\\)', '')) AS name_plain,
         nullif(regexp_extract(entity_name, '\\(([A-Z]{3,})\\)', 1), '') AS abbreviation
  FROM gold.government_entity
  WHERE chamber_or_agency NOT IN ('House', 'Senate')),
agencies AS (
  SELECT lp.lobbyist_id, 'agency' AS kind, g.entity_hk AS ref_id, g.entity_name AS ref_name,
         CASE WHEN lower(lp.position_text) LIKE concat('%', lower(g.name_plain), '%') THEN g.name_plain
              ELSE g.abbreviation END AS matched_text,
         'medium' AS confidence
  FROM gold.lobbyist_position lp
  JOIN agency g ON g.name_plain <> ''
    AND (lower(lp.position_text) LIKE concat('%', lower(g.name_plain), '%')
         OR (g.abbreviation IS NOT NULL AND lp.position_text RLIKE concat('\\b', g.abbreviation, '\\b')))),
collapsed AS (
  SELECT lobbyist_id, kind, ref_id, max(ref_name) AS ref_name,
         min_by(matched_text, concat(confidence, '|', matched_text)) AS matched_text, min(confidence) AS confidence
  FROM (SELECT * FROM committees UNION ALL SELECT * FROM members UNION ALL SELECT * FROM agencies)
  GROUP BY lobbyist_id, kind, ref_id),
jurisdiction AS (
  SELECT thomas_id, array_join(array_sort(collect_set(issue_code)), ', ') AS jurisdiction_issues
  FROM gold.issue_committee GROUP BY thomas_id)
SELECT x.lobbyist_id, x.kind, x.ref_id, x.ref_name, x.matched_text, x.confidence, j.jurisdiction_issues
FROM collapsed x
LEFT JOIN jurisdiction j ON x.kind = 'committee' AND j.thomas_id = x.ref_id;

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

-- revolving_door: one row per lobbyist with at least one affiliation and
-- each engagement that listed them. kind and ref_name collapse every
-- affiliation of the lobbyist, sorted, joined with ', '.
-- jurisdiction_match is true when a committee the lobbyist disclosed
-- has jurisdiction (issue_committee) over an issue code the engagement
-- has listed on any filing (link_engagement_issue).
CREATE OR REPLACE TABLE gold.revolving_door AS
WITH committee AS (
  SELECT hc.committee_bk AS thomas_id, p.chamber
  FROM silver.hub_committee hc
  JOIN silver.sat_committee_profile p ON p.committee_hk = hc.committee_hk
  QUALIFY row_number() OVER (PARTITION BY hc.committee_hk ORDER BY p.load_date DESC, p.hash_diff) = 1),
legislator AS (
  SELECT h.legislator_bk AS bioguide_id, p.type
  FROM silver.hub_legislator h
  JOIN silver.sat_legislator_profile p ON p.legislator_hk = h.legislator_hk
  QUALIFY row_number() OVER (PARTITION BY h.legislator_hk ORDER BY p.load_date DESC, p.hash_diff) = 1),
aff AS (
  SELECT a.lobbyist_id, a.kind, a.ref_id, a.ref_name,
         CASE WHEN a.kind = 'committee' THEN CASE c.chamber WHEN 'house' THEN 'House' WHEN 'senate' THEN 'Senate' END
              WHEN a.kind = 'member' THEN CASE l.type WHEN 'sen' THEN 'Senate' WHEN 'rep' THEN 'House' END END AS chamber
  FROM gold.lobbyist_affiliation a
  LEFT JOIN committee c ON a.kind = 'committee' AND c.thomas_id = a.ref_id
  LEFT JOIN legislator l ON a.kind = 'member' AND l.bioguide_id = a.ref_id),
contacted AS (
  SELECT DISTINCT l.engagement_hk, g.entity_hk, g.chamber_or_agency
  FROM silver.link_engagement_government_entity l
  JOIN gold.government_entity g ON g.entity_hk = l.entity_hk),
pair AS (
  SELECT le.lobbyist_id, le.engagement_hk,
         array_join(array_sort(collect_set(a.kind)), ', ') AS kind,
         array_join(array_sort(collect_set(a.ref_name)), ', ') AS ref_name,
         max(c.entity_hk IS NOT NULL) AS lobbies_former_employer
  FROM gold.lobbyist_engagement le
  JOIN aff a ON a.lobbyist_id = le.lobbyist_id
  LEFT JOIN contacted c ON c.engagement_hk = le.engagement_hk
    AND ((a.kind = 'agency' AND c.entity_hk = a.ref_id) OR (a.chamber IS NOT NULL AND c.chamber_or_agency = a.chamber))
  GROUP BY le.lobbyist_id, le.engagement_hk),
engagement_issue AS (
  SELECT DISTINCT li.engagement_hk, hi.issue_bk AS issue_code
  FROM silver.link_engagement_issue li
  JOIN silver.hub_issue hi ON hi.issue_hk = li.issue_hk),
jurisdiction AS (
  SELECT DISTINCT le.lobbyist_id, le.engagement_hk
  FROM gold.lobbyist_engagement le
  JOIN gold.lobbyist_affiliation a ON a.lobbyist_id = le.lobbyist_id AND a.kind = 'committee'
  JOIN gold.issue_committee ic ON ic.thomas_id = a.ref_id
  JOIN engagement_issue ei ON ei.engagement_hk = le.engagement_hk AND ei.issue_code = ic.issue_code),
profile AS (
  SELECT hl.lobbyist_bk AS lobbyist_id, initcap(concat_ws(' ', p.first_name, p.last_name)) AS full_name
  FROM silver.hub_lobbyist hl
  JOIN silver.sat_lobbyist_profile p ON p.lobbyist_hk = hl.lobbyist_hk
  QUALIFY row_number() OVER (PARTITION BY hl.lobbyist_hk ORDER BY p.load_date DESC, p.hash_diff) = 1)
SELECT p.lobbyist_id, p.engagement_hk, pr.full_name, p.kind, p.ref_name,
       le.client_id, le.client, le.registrant_id, le.firm, g.issue_codes,
       le.income_while_listed AS income, p.lobbies_former_employer,
       j.lobbyist_id IS NOT NULL AS jurisdiction_match
FROM pair p
JOIN gold.lobbyist_engagement le ON le.lobbyist_id = p.lobbyist_id AND le.engagement_hk = p.engagement_hk
JOIN gold.engagement g ON g.engagement_hk = p.engagement_hk
LEFT JOIN profile pr ON pr.lobbyist_id = p.lobbyist_id
LEFT JOIN jurisdiction j ON j.lobbyist_id = p.lobbyist_id AND j.engagement_hk = p.engagement_hk;

-- lobbyist: one row per individual lobbyist. covered_positions is the
-- disclosed former government roles, verbatim from the filings, distinct
-- and joined with ' | '. Quarters count the quarterly reports that list
-- the person, so someone named only on a registration has 0.
-- affiliation_count and lobbies_former_employer come from the revolving
-- door marts above.
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
  FROM listed GROUP BY lobbyist_hk),
affiliations AS (
  SELECT lobbyist_id, count(*) AS affiliation_count FROM gold.lobbyist_affiliation GROUP BY lobbyist_id),
former AS (
  SELECT lobbyist_id, max(lobbies_former_employer) AS lobbies_former_employer FROM gold.revolving_door GROUP BY lobbyist_id)
SELECT hl.lobbyist_bk AS lobbyist_id,
       initcap(concat_ws(' ', p.first_name, p.last_name)) AS full_name,
       a.covered_positions,
       CAST(coalesce(a.client_count, 0) AS INT) AS client_count,
       CAST(coalesce(a.firm_count, 0) AS INT) AS firm_count,
       CAST(coalesce(a.quarters_active, 0) AS INT) AS quarters_active,
       a.first_period, a.last_period,
       CAST(coalesce(af.affiliation_count, 0) AS INT) AS affiliation_count,
       coalesce(fm.lobbies_former_employer, false) AS lobbies_former_employer
FROM silver.hub_lobbyist hl
LEFT JOIN profile p ON p.lobbyist_hk = hl.lobbyist_hk
LEFT JOIN agg a ON a.lobbyist_hk = hl.lobbyist_hk
LEFT JOIN affiliations af ON af.lobbyist_id = hl.lobbyist_bk
LEFT JOIN former fm ON fm.lobbyist_id = hl.lobbyist_bk;

-- search_entity: every client and firm name in one list for the home
-- page search box. organization_hk and organization_name let the search
-- collapse the client records of one organization; null for a firm.
CREATE OR REPLACE TABLE gold.search_entity AS
SELECT 'client' AS kind, client_id AS id, name, total_income, organization_hk, organization_name FROM gold.client
UNION ALL
SELECT 'firm' AS kind, registrant_id AS id, name, total_income, CAST(NULL AS STRING) AS organization_hk,
       CAST(NULL AS STRING) AS organization_name FROM gold.firm;

-- ---------------------------------------------------------------------
-- Surge signal. Rule, stated once: a quarter's income is compared with
-- the entity's prior reported quarters (at least three; quarters with no
-- report are not filled in). z is (income - mean of the prior quarters)
-- / sample standard deviation of the prior quarters, null when that
-- deviation is zero. is_surge is z >= 2. kind is client, firm or issue;
-- the issue series carries rule 1 (a report counts toward every issue
-- code it lists).
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE gold.surge AS
WITH series AS (
  SELECT 'client' AS kind, client_id AS id, period_end_date, income FROM gold.client_quarter
  UNION ALL SELECT 'firm', registrant_id, period_end_date, income FROM gold.firm_quarter
  UNION ALL SELECT 'issue', issue_code, period_end_date, income FROM gold.topic_quarter),
prior AS (
  SELECT kind, id, period_end_date, income,
         count(*) OVER w AS prior_quarters,
         avg(income) OVER w AS mean_prior,
         stddev_samp(income) OVER w AS stddev_prior
  FROM series
  WINDOW w AS (PARTITION BY kind, id ORDER BY period_end_date ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)),
scored AS (
  SELECT kind, id, period_end_date, income,
         CAST(mean_prior AS DECIMAL(14,2)) AS mean_prior,
         CAST(stddev_prior AS DECIMAL(14,2)) AS stddev_prior,
         CASE WHEN stddev_prior > 0 THEN round((income - mean_prior) / stddev_prior, 2) END AS z
  FROM prior
  WHERE prior_quarters >= 3)
SELECT s.kind, s.id, coalesce(c.name, f.name, n.issue_name, s.id) AS name, s.period_end_date, s.income,
       s.mean_prior, s.stddev_prior, CAST(s.z AS DOUBLE) AS z, coalesce(s.z >= 2, false) AS is_surge
FROM scored s
LEFT JOIN gold.client c ON s.kind = 'client' AND c.client_id = s.id
LEFT JOIN gold.firm f ON s.kind = 'firm' AND f.registrant_id = s.id
LEFT JOIN gold.issue_name n ON s.kind = 'issue' AND n.issue_code = s.id;

-- ---------------------------------------------------------------------
-- Filing timing. Rule, stated once: a quarterly report is due 20 days
-- after the period ends (LDA section 5), counted in calendar days; that
-- is due_date. When the 20th day falls on a Saturday or Sunday the
-- deadline moves to the Monday, and when it lands on Martin Luther King
-- Jr. Day (the third Monday of January, the only federal holiday that
-- can fall on a quarterly due date) it moves to the Tuesday; that is
-- due_date_observed. The report that meets the deadline is the first
-- version posted for the engagement and period, so the row carries the
-- first-posted version's filing_uuid and posting time, not the amendment
-- that wins elsewhere (rule 3). Days are counted in Eastern time, the
-- LDA filing clock: posted_date and posted_weekday come from the posting
-- time rendered in America/New_York, and days_late is posted_date minus
-- due_date_observed, negative when early. days_late, posted_weekday and
-- posted_hour_utc are null only when the posting time is unknown.
-- posted_hour_utc is the hour in UTC.
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE gold.filing_timing AS
WITH first_version AS (
  SELECT engagement_hk, filing_year, filing_period, filing_uuid, dt_posted
  FROM silver.sat_engagement_filing
  WHERE filing_type NOT IN ('RR', 'RA')
  QUALIFY row_number() OVER (PARTITION BY engagement_hk, filing_year, filing_period
                             ORDER BY dt_posted ASC NULLS LAST, filing_uuid) = 1),
due AS (
  SELECT period_end_date, due_date,
         CASE WHEN month(rolled) = 1 AND dayofweek(rolled) = 2 AND day(rolled) BETWEEN 15 AND 21
              THEN date_add(rolled, 1) ELSE rolled END AS due_date_observed
  FROM (SELECT period_end_date, due_date,
               CASE dayofweek(due_date) WHEN 7 THEN date_add(due_date, 2)
                                        WHEN 1 THEN date_add(due_date, 1)
                                        ELSE due_date END AS rolled
        FROM (SELECT DISTINCT period_end_date, date_add(period_end_date, 20) AS due_date FROM gold.fact_filing))),
timed AS (
  SELECT f.engagement_hk, f.registrant_hk, f.client_hk, f.period_end_date, v.filing_uuid, v.dt_posted,
         convert_timezone('America/New_York', v.dt_posted) AS posted_et
  FROM gold.fact_filing f
  JOIN first_version v ON v.engagement_hk = f.engagement_hk AND v.filing_year = f.filing_year AND v.filing_period = f.filing_period)
SELECT t.filing_uuid, t.engagement_hk, hr.registrant_bk AS registrant_id, hc.client_bk AS client_id,
       t.period_end_date, d.due_date, d.due_date_observed,
       CAST(t.posted_et AS DATE) AS posted_date,
       CAST(datediff(CAST(t.posted_et AS DATE), d.due_date_observed) AS INT) AS days_late,
       date_format(t.posted_et, 'EEEE') AS posted_weekday,
       CAST(hour(convert_timezone('UTC', t.dt_posted)) AS INT) AS posted_hour_utc
FROM timed t
JOIN due d ON d.period_end_date = t.period_end_date
JOIN silver.hub_registrant hr ON hr.registrant_hk = t.registrant_hk
JOIN silver.hub_client hc ON hc.client_hk = t.client_hk;

-- ---------------------------------------------------------------------
-- Peer outliers. Rule, stated once: within an issue code, every firm (or
-- client) with reported income under that code is ranked by that income
-- (topic_firm, topic_client, so rule 1 applies). pct_rank is the SQL
-- percent rank, 0 for the lowest income and 1 for the highest, so the
-- top 5 percent is pct_rank >= 0.95.
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE gold.peer_rank AS
SELECT kind, id, issue_code, income,
       CAST(percent_rank() OVER (PARTITION BY kind, issue_code ORDER BY income) AS DOUBLE) AS pct_rank
FROM (SELECT 'firm' AS kind, registrant_id AS id, issue_code, income FROM gold.topic_firm
      UNION ALL SELECT 'client', client_id, issue_code, income FROM gold.topic_client);

-- ---------------------------------------------------------------------
-- Network edges. Rule, stated once: one row per pair, three pair kinds.
-- client to firm, weighted by the income reported on the engagement;
-- engagement to bill, weighted by the filings mentioning the bill, where
-- the bill id is the congress and the key ("118-HR1"); lobbyist to
-- engagement, weighted by the quarters the lobbyist was listed.
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE gold.edge AS
SELECT 'client' AS src_kind, client_id AS src_id, 'firm' AS dst_kind, registrant_id AS dst_id,
       CAST(sum(total_income) AS DECIMAL(14,2)) AS weight
FROM gold.engagement
GROUP BY client_id, registrant_id
UNION ALL
SELECT 'engagement', engagement_hk, 'bill', concat(CAST(congress AS STRING), '-', bill_key),
       CAST(filings_mentioning AS DECIMAL(14,2))
FROM gold.bill_engagement
UNION ALL
SELECT 'lobbyist', lobbyist_id, 'engagement', engagement_hk, CAST(quarters_listed AS DECIMAL(14,2))
FROM gold.lobbyist_engagement;
