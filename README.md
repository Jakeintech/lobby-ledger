# Lobby Ledger

Who lobbies Congress, for whom, on what, and for how much, quarter by quarter.

Live site: https://lobbying.jakeawilliams.com

Lobby Ledger is a public explorer of U.S. federal lobbying disclosures. Every lobbying firm files a report each quarter for each client it represents: what it was paid, which issues and bills it worked on, which lobbyists were on the account and which parts of government they contacted. This repo pulls those filings from the Senate's Lobbying Disclosure Act API, models them in a Databricks lakehouse, and serves them through a small React app with a page for every topic, bill, client, firm and lobbyist. Each page is built around one chart: that entity's reported income or activity by quarter.

The data slice is every registrant-client engagement that reported at least $500,000 on any filing in 2024 or 2025, with its complete 2024-2025 history. Topics are not chosen by hand; they are the issue codes that appear on those filings, ranked by income.

## Architecture

```
Senate LDA API (lda.senate.gov)
   |  ingest/pull_lda.py           seed by reported income, pull full history, cache every page
   v
BRONZE   workspace.bronze.lda_*    source-shaped CSV -> Delta, + load_date, record_source
   |  sql/lakehouse.sql            HARD RULES: cast, trim, upper, md5, WHERE NOT EXISTS
   v
SILVER   Raw Vault                 hubs (registrant, client, lobbyist, issue, government entity),
                                   links (engagement, lobbyist, issue, entity), satellites with hash_diff
   |                               SOFT RULES: amendments, income attribution, status
   v
GOLD     one mart per page         topic, topic_quarter, bill, client, firm, lobbyist, engagement,
                                   engagement_quarter and their companions; ai_query summaries
   |  SQL warehouse + Unity Catalog, one read-only identity per host
   v
APP      app/config/queries/*.sql  ->  /api/analytics/query/<name>  ->  React pages
         Vercel container (public)  and  Databricks Apps (workspace)
```

Hard rules stop at Silver and soft rules start at Gold. Every Silver insert is guarded by a hash key or a `hash_diff`, so rerunning the load inserts nothing. The app reads Gold only, through fixed SQL files with typed parameters, as a service principal that cannot see Bronze or Silver.

## Pages

| Page | URL | What it shows |
|---|---|---|
| Home | `/` | Total reported income by quarter, issue areas ranked by income, search by bill number or organization |
| Topic | `/topic/TAX` | Income by quarter for the issue, top clients and firms, bills most cited, every engagement |
| Bill | `/bill/HR1` | Filings mentioning the bill by quarter, and who is lobbying on it for whom |
| Client | `/client/63876` | Firms hired, income by quarter, issues, bills, government entities contacted, lobbyists listed |
| Firm | `/firm/682` | Clients by income, income by quarter, issue mix, roster of lobbyists |
| Lobbyist | `/lobbyist/68995` | Clients and firms, quarters active, disclosed former government positions |
| About | `/about` | Source, freshness, definitions, the attribution rule, AI-summary disclaimer, this diagram |

## Schema objects

| Layer | Object | Role |
|---|---|---|
| Bronze | `bronze.landing` (volume) | Landing zone for the six CSVs |
| Bronze | `lda_filings`, `lda_registrants`, `lda_clients`, `lda_lobbyists`, `lda_lobbying_activities`, `lda_government_entities` | Source columns as they arrived plus `load_date` and `record_source` |
| Silver | `hub_registrant`, `hub_client`, `hub_lobbyist`, `hub_issue`, `hub_government_entity` | One row per business key; `*_hk = md5(upper(trim(bk)))` |
| Silver | `link_engagement` | One registrant working for one client; hash of both keys |
| Silver | `link_engagement_lobbyist`, `link_engagement_issue`, `link_engagement_government_entity` | Which lobbyists, issue codes and government entities an engagement has touched |
| Silver | `v_filing_keys` | Staging view: every filing with its engagement hash and typed columns |
| Silver | `sat_engagement_filing` | One row per quarterly filing, guarded by `hash_diff` |
| Silver | `sat_engagement_issues_text`, `sat_engagement_lobbyist_filing` | Free-text issue descriptions per filing; who was listed on which filing, with covered position |
| Silver | `sat_client_profile`, `sat_registrant_profile`, `sat_lobbyist_profile` | Descriptive attributes, new row only on change |
| Gold | `fact_filing` | Quarterly reports only, latest amendment wins, real quarter-end dates |
| Gold | `engagement_quarter`, `engagement` | One row per engagement and quarter; one row per engagement with totals, status, bills, entities and the AI summary |
| Gold | `topic`, `topic_quarter`, `topic_client`, `topic_firm`, `topic_bill` | The topic page |
| Gold | `bill`, `bill_quarter`, `engagement_bill`, `filing_bill` | Bill numbers extracted from the issue text (H.R., S., resolutions) and their use over time |
| Gold | `client`, `client_quarter` | The client page |
| Gold | `firm`, `firm_quarter` | The firm page |
| Gold | `lobbyist`, `lobbyist_engagement` | The lobbyist page, including disclosed covered positions |
| Gold | `search_entity`, `issue_name`, `engagement_issue_text`, `engagement_ai_summary` | Search, issue display names, text input to the model, one-sentence summaries |
| Tests | `sql/tests.sql` | 99 assertions: unique keys, link-to-hub references, one version per `hash_diff`, bill pattern, no null income, status rules |
| Grants | `sql/grants.sql` | USE CATALOG, USE SCHEMA and SELECT on Gold for the two app principals, nothing else |

Rules stated once in `sql/lakehouse.sql`: a filing's income counts in full toward every issue code it lists, so topic totals overlap and are never summed across topics; registrations carry no income; the latest amendment for an engagement and period wins; an engagement is lapsed when its last quarterly report was a termination or it stopped filing before the newest quarter in the data; null income means zero.

## Run it

Authenticate the Databricks CLI, then:

```
export DATABRICKS_WAREHOUSE_ID=<serverless warehouse id>
export AI_ENDPOINT=databricks-meta-llama-3-3-70b-instruct   # any pay-per-token chat endpoint

python3 ingest/pull_lda.py                      # 30 to 60 minutes at the API rate limit, restartable
for f in data/*.csv; do databricks fs cp "$f" dbfs:/Volumes/workspace/bronze/landing/ --overwrite; done
python3 sql/run_sql.py sql/bronze.sql
python3 sql/run_sql.py sql/lakehouse.sql        # safe to run again
python3 sql/run_sql.py sql/tests.sql            # expect every failure count to be 0
python3 sql/run_sql.py sql/proof.sql
python3 sql/run_sql.py sql/grants.sql

cd app && pnpm install && pnpm run typegen && pnpm run dev   # http://localhost:8000
cd app && databricks apps deploy                               # workspace copy
cd app && vercel deploy --prod                                 # public copy, container image from Dockerfile.vercel
```

The public copy needs four project environment variables on Vercel: `DATABRICKS_HOST`, `DATABRICKS_CLIENT_ID`, `DATABRICKS_CLIENT_SECRET` (a service principal with Gold read only) and `DATABRICKS_WAREHOUSE_ID`. The `/api/*` routes are rate-limited at the edge.

## What I would do next

- Refresh on a schedule: a Lakeflow job that reruns the ingest for the latest quarter and the lakehouse script, which is already idempotent.
- Widen the slice below $500k once the pull runs under an API key with a higher rate limit.
- Link lobbyists' disclosed covered positions to the members and committees they name, for a revolving-door view.
- Add campaign-finance data as a second source; the vault already keys clients and people by hash, so a new source is new satellites, not a remodel.

Decisions are recorded in [docs/adr](docs/adr) and the layer-by-layer tour with a presentation script is in [docs/walkthrough.md](docs/walkthrough.md).
