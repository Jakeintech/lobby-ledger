-- bronze.sql
-- Lands the CSVs from ingest/pull_lda.py as source-shaped Bronze tables.
-- Upload first: databricks fs cp -r data/ dbfs:/Volumes/workspace/bronze/landing/ --overwrite
-- (the CSVs sit at the top of data/; raw JSON stays local).
-- Bronze keeps the source columns as they arrived and adds only lineage:
-- load_date and record_source. No renames, no business logic.

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

SELECT 'filings' AS t, count(*) FROM bronze.lda_filings
UNION ALL SELECT 'registrants', count(*) FROM bronze.lda_registrants
UNION ALL SELECT 'clients', count(*) FROM bronze.lda_clients
UNION ALL SELECT 'lobbyists', count(*) FROM bronze.lda_lobbyists
UNION ALL SELECT 'lobbying_activities', count(*) FROM bronze.lda_lobbying_activities;
