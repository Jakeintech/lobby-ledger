# Lobbying Experience Search

Live app: https://lobbying-experience-search-7474655336005380.aws.databricksapps.com (Databricks workspace login required).

A miniature Databricks lakehouse built on public U.S. Lobbying Disclosure Act (LDA) filings. Lobbying firms file a report every quarter for every client they represent, listing the lobbyists who worked on it, the issues they covered and what they were paid. This repo lands 245 real filings in a Bronze layer, models them as a Data Vault 2.0 in Silver, publishes a Business Vault and marts in Gold, and puts a small Databricks AppKit app on top that answers one question: "find every engagement like this one, who worked it, and what it was about." An `ai_query()` call writes a one-sentence summary per engagement, and a secure view filters results by the signed-in user.

The domain is a stand-in for professional-services data: a lobbying firm is the firm, a lobbyist is a timekeeper, a general issue code is a practice group, and a firm-client engagement is a matter observed once per quarter. The point of the build is the modelling discipline, not the data: hard rules (cast, trim, hash, dedupe) stop at Silver, soft rules (status, totals, as-of logic) start at Gold, every Silver insert is idempotent through hash keys and `hash_diff`, and the app reads Gold only.

## Architecture

```
LDA API (lda.senate.gov)
   |  ingest/pull_lda.py            sample 46 engagements, pull every 2024-2025 filing
   v
BRONZE   workspace.bronze.lda_*     source-shaped CSV -> Delta, + load_date, record_source
   |  sql/lakehouse.sql             HARD RULES: cast, trim, upper, md5, WHERE NOT EXISTS
   v
SILVER   Raw Vault                  hub_*, link_*, sat_* (hash keys, hash_diff, effectivity)
   |                                SOFT RULES: amendments, status, totals, as-of
   v
GOLD     Business Vault             fact_filing, pit_engagement, bridge_*, sat_engagement_computed
         Marts                      dim_*, engagement_issue_text, engagement_ai_summary (ai_query)
         Product                    experience_search view, experience_search_secure (current_user)
   |  SQL warehouse + Unity Catalog
   v
APPKIT   app/config/queries/*.sql  ->  /api/analytics/query/<name>  ->  React UI
         experience_search.sql (service principal, cached)
         engagement_team.obo.sql (runs as the signed-in user)
         engagement_asof.sql (reads the PIT table)
```

## Schema objects

| Layer | Object | Role |
|---|---|---|
| Bronze | `bronze.landing` (volume) | Landing zone for the five CSVs |
| Bronze | `bronze.lda_filings`, `lda_registrants`, `lda_clients`, `lda_lobbyists`, `lda_lobbying_activities` | Source columns as they arrived plus `load_date` and `record_source` |
| Silver | `hub_registrant`, `hub_client`, `hub_lobbyist`, `hub_issue` | One row per business key; `*_hk = md5(upper(trim(bk)))` |
| Silver | `link_engagement` | The matter: a registrant working for a client; hash of both keys |
| Silver | `link_engagement_lobbyist`, `link_engagement_issue` | Which lobbyists and issue codes an engagement has ever touched |
| Silver | `v_filing_keys` | Staging view: every filing with its engagement hash and typed columns |
| Silver | `sat_engagement_filing` | Type-2 history, one row per quarterly filing, guarded by `hash_diff` |
| Silver | `sat_engagement_issues_text` | Free-text issue descriptions per filing and code |
| Silver | `sat_engagement_lobbyist_filing` | Effectivity: who was listed on which filing |
| Silver | `sat_client_profile`, `sat_registrant_profile`, `sat_lobbyist_profile` | Descriptive attributes, new row only on change |
| Gold | `fact_filing` | Quarterly reports only, latest amendment wins, real quarter-end dates |
| Gold | `pit_engagement` | Point-in-time: the current filing for every engagement at every quarter end |
| Gold | `bridge_registrant_client_lobbyist` | Pre-walked hub-link-hub path, one row per engagement, lobbyist, filing |
| Gold | `sat_engagement_computed` | Business rules: status, total income, quarters active |
| Gold | `dim_registrant`, `dim_client`, `dim_lobbyist` | Current profile per hub |
| Gold | `engagement_issue_text` | All issue text per engagement, input to search and AI |
| Gold | `engagement_ai_summary` | One sentence per engagement from `ai_query()`, only computed once |
| Gold | `experience_search` | The product view the app reads |
| Gold | `engagement_access`, `experience_search_secure` | Row-level access by `current_user()` |
| Grants | `sql/grants.sql` | USE CATALOG, USE SCHEMA and SELECT on Gold for the app service principal and a user |

## Run it

Authenticate the Databricks CLI (a service principal or OAuth login), then:

```
export DATABRICKS_WAREHOUSE_ID=<serverless warehouse id>
export AI_ENDPOINT=databricks-meta-llama-3-3-70b-instruct   # any pay-per-token chat endpoint

python3 ingest/pull_lda.py                      # optional, refreshes data/*.csv
python3 sql/run_sql.py sql/bronze.sql           # schema, volume, then upload data/*.csv to
                                                # /Volumes/workspace/bronze/landing before the tables
python3 sql/run_sql.py sql/lakehouse.sql        # Silver and Gold; safe to run again
python3 sql/run_sql.py sql/proof.sql            # idempotency and row-count checks
python3 sql/run_sql.py sql/grants.sql           # Gold grants for the app service principal and a user

cd app && pnpm install && pnpm run typegen && pnpm run dev   # http://localhost:8000
cd app && databricks apps deploy                               # validate, upload, build, start
```

Proof from the first two runs: 245 satellite rows and 245 distinct `filing_uuid || hash_diff` versions before and after a rerun, 46 engagements in `experience_search`, 46 AI summaries, 212 PIT rows, 651 bridge rows, 203 quarterly facts.

## What I would do next

- Confirm the `.obo.sql` query reports the signed-in user's email in `queried_as` now that the app is deployed with the `sql` user scope.
- Replace the CSV pull with Lakeflow Connect or Auto Loader and make Bronze append-only with a `load_date` watermark.
- Add a second load with changed income to show `hash_diff` creating a new satellite row and `pit_engagement` moving.
- Express the Gold rules as a dbt project or Lakeflow Declarative Pipeline with tests on hash-key uniqueness.
- Put a Playwright smoke test and `databricks apps validate` in CI.

Decisions are recorded in [docs/adr](docs/adr) and the full tour is in [docs/walkthrough.md](docs/walkthrough.md).
