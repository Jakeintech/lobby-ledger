-- bronze.sql
-- Lands the CSVs from ingest/pull_lda.py, ingest/pull_bills.py and the
-- unitedstates reference files as source-shaped Bronze tables.
-- Upload first: databricks fs cp -r data/ dbfs:/Volumes/workspace/bronze/landing/ --overwrite
-- and the same for data/reference/*.csv (the CSVs sit at the top of data/
-- and data/reference/; raw JSON stays local).
-- Bronze keeps the source columns as they arrived and adds only lineage:
-- load_date and record_source. No renames, no business logic.
--
-- A CSV that has not landed yet (foreign_entities, affiliated_organizations
-- before the full pull finishes; bills and bill_actions before the
-- Congress.gov key arrives) makes its read_files statement fail. Until it
-- lands, create that table empty with the CSV's columns as STRING plus the
-- two lineage columns, so every Silver and Gold statement still runs:
--   CREATE TABLE IF NOT EXISTS bronze.<table> (<csv columns> STRING, load_date TIMESTAMP, record_source STRING);

CREATE SCHEMA IF NOT EXISTS bronze;
CREATE VOLUME IF NOT EXISTS bronze.landing;

CREATE OR REPLACE TABLE bronze.lda_filings AS
SELECT *, current_timestamp() AS load_date, 'lda.senate.gov' AS record_source
FROM read_files('/Volumes/workspace/bronze/landing/filings.csv', format => 'csv', header => true, inferSchema => false);

CREATE OR REPLACE TABLE bronze.lda_registrants AS
SELECT *, current_timestamp() AS load_date, 'lda.senate.gov' AS record_source
FROM read_files('/Volumes/workspace/bronze/landing/registrants.csv', format => 'csv', header => true, inferSchema => false);

CREATE OR REPLACE TABLE bronze.lda_clients AS
SELECT *, current_timestamp() AS load_date, 'lda.senate.gov' AS record_source
FROM read_files('/Volumes/workspace/bronze/landing/clients.csv', format => 'csv', header => true, inferSchema => false);

CREATE OR REPLACE TABLE bronze.lda_lobbyists AS
SELECT *, current_timestamp() AS load_date, 'lda.senate.gov' AS record_source
FROM read_files('/Volumes/workspace/bronze/landing/lobbyists.csv', format => 'csv', header => true, inferSchema => false);

CREATE OR REPLACE TABLE bronze.lda_lobbying_activities AS
SELECT *, current_timestamp() AS load_date, 'lda.senate.gov' AS record_source
FROM read_files('/Volumes/workspace/bronze/landing/lobbying_activities.csv', format => 'csv', header => true,
                inferSchema => false, multiLine => true);

CREATE OR REPLACE TABLE bronze.lda_government_entities AS
SELECT *, current_timestamp() AS load_date, 'lda.senate.gov' AS record_source
FROM read_files('/Volumes/workspace/bronze/landing/government_entities.csv', format => 'csv', header => true, inferSchema => false);

-- Foreign entities and affiliated organizations named on a filing
-- (LD-1 and LD-2 sections 14 and 15), from the same pull.
CREATE OR REPLACE TABLE bronze.lda_foreign_entities AS
SELECT *, current_timestamp() AS load_date, 'lda.senate.gov' AS record_source
FROM read_files('/Volumes/workspace/bronze/landing/foreign_entities.csv', format => 'csv', header => true, inferSchema => false);

CREATE OR REPLACE TABLE bronze.lda_affiliated_organizations AS
SELECT *, current_timestamp() AS load_date, 'lda.senate.gov' AS record_source
FROM read_files('/Volumes/workspace/bronze/landing/affiliated_organizations.csv', format => 'csv', header => true, inferSchema => false);

-- Reference data from the unitedstates project (data/reference/). The two
-- legislator files share one header; is_current says which file a row
-- came from.
CREATE OR REPLACE TABLE bronze.ref_committees AS
SELECT *, current_timestamp() AS load_date, 'unitedstates/congress-legislators' AS record_source
FROM read_files('/Volumes/workspace/bronze/landing/committees.csv', format => 'csv', header => true,
                inferSchema => false, multiLine => true);

CREATE OR REPLACE TABLE bronze.ref_legislators AS
SELECT *, true AS is_current, current_timestamp() AS load_date, 'unitedstates/congress-legislators' AS record_source
FROM read_files('/Volumes/workspace/bronze/landing/legislators-current.csv', format => 'csv', header => true,
                inferSchema => false, multiLine => true)
UNION ALL
SELECT *, false AS is_current, current_timestamp() AS load_date, 'unitedstates/congress-legislators' AS record_source
FROM read_files('/Volumes/workspace/bronze/landing/legislators-historical.csv', format => 'csv', header => true,
                inferSchema => false, multiLine => true);

-- Curated by hand in this repo: which standing committee of each chamber
-- has jurisdiction over each LDA general issue code (data/reference/
-- issue_committees.csv, one row per issue code, chamber and thomas id).
CREATE OR REPLACE TABLE bronze.ref_issue_committees AS
SELECT *, current_timestamp() AS load_date, 'lobby-ledger/data/reference' AS record_source
FROM read_files('/Volumes/workspace/bronze/landing/issue_committees.csv', format => 'csv', header => true,
                inferSchema => false);

-- Bills from the Congress.gov API (ingest/pull_bills.py), which runs after
-- Gold exists because it reads gold.bill_congress for the keys to fetch.
CREATE OR REPLACE TABLE bronze.congress_bills AS
SELECT *, current_timestamp() AS load_date, 'api.congress.gov' AS record_source
FROM read_files('/Volumes/workspace/bronze/landing/bills.csv', format => 'csv', header => true,
                inferSchema => false, multiLine => true);

CREATE OR REPLACE TABLE bronze.congress_bill_actions AS
SELECT *, current_timestamp() AS load_date, 'api.congress.gov' AS record_source
FROM read_files('/Volumes/workspace/bronze/landing/bill_actions.csv', format => 'csv', header => true,
                inferSchema => false, multiLine => true);

SELECT 'filings' AS t, count(*) FROM bronze.lda_filings
UNION ALL SELECT 'registrants', count(*) FROM bronze.lda_registrants
UNION ALL SELECT 'clients', count(*) FROM bronze.lda_clients
UNION ALL SELECT 'lobbyists', count(*) FROM bronze.lda_lobbyists
UNION ALL SELECT 'lobbying_activities', count(*) FROM bronze.lda_lobbying_activities
UNION ALL SELECT 'government_entities', count(*) FROM bronze.lda_government_entities
UNION ALL SELECT 'foreign_entities', count(*) FROM bronze.lda_foreign_entities
UNION ALL SELECT 'affiliated_organizations', count(*) FROM bronze.lda_affiliated_organizations
UNION ALL SELECT 'ref_committees', count(*) FROM bronze.ref_committees
UNION ALL SELECT 'ref_legislators', count(*) FROM bronze.ref_legislators
UNION ALL SELECT 'ref_issue_committees', count(*) FROM bronze.ref_issue_committees
UNION ALL SELECT 'congress_bills', count(*) FROM bronze.congress_bills
UNION ALL SELECT 'congress_bill_actions', count(*) FROM bronze.congress_bill_actions;
