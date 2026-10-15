# Lobby Ledger

Who lobbies Congress, for whom, on what, and for how much, quarter by quarter.

Live site: https://lobbying.jakeawilliams.com

Lobby Ledger is a public explorer of U.S. federal lobbying disclosures. Every lobbying firm files a report each quarter for each client it represents: what it was paid, which issues and bills it worked on, which lobbyists were on the account, which parts of government they contacted, and whether any foreign entity funds the client. This repo pulls every 2024 and 2025 filing from the Senate's Lobbying Disclosure Act API (about 207,000 filings), models them in a Databricks lakehouse, and serves them through a React app where every topic, bill, client, firm, lobbyist, government entity and country has its own page built around one chart: that entity's reported income or activity by quarter.

Beyond the entity pages, the lakehouse connects the dots the raw filings leave loose:

- **Bills and their legislative story.** Bill numbers are extracted from the filing text and enriched from Congress.gov with title, sponsor, policy area and milestone dates, so a bill page shows lobbying activity and the bill's progress on the same timeline, and the site can answer which bills drew the most lobbying and which became law.
- **Keyword trends.** Any phrase ("artificial intelligence", "tariff", "PFAS") charted as filings mentioning it and income behind it, quarter by quarter, with the clients driving it.
- **Foreign-funded lobbying.** Filings with foreign entities or clients headquartered abroad, by country and quarter.
- **Who gets lobbied.** Every agency, chamber and office named on a filing, ranked, with the issues and clients behind the contacts.
- **The revolving door.** Lobbyists' disclosed former government positions matched to committees and members, and whether they now lobby the body they came from. Labelled as the lobbyist's own disclosure because the matching is textual.

## Architecture

```
Senate LDA API                 Congress.gov API            unitedstates project
   |  ingest/pull_lda.py          |  ingest/pull_bills.py     |  legislators, committees
   v                              v                           v
BRONZE   workspace.bronze.*     source-shaped CSV -> Delta, + load_date, record_source
   |  sql/lakehouse.sql         HARD RULES: cast, trim, upper, md5, WHERE NOT EXISTS
   v
SILVER   Raw Vault              hubs (registrant, client, lobbyist, issue, government entity,
                                foreign entity, bill, legislator, committee), links, satellites with hash_diff
   |                            SOFT RULES: amendments, income attribution, status, text matching
   v
GOLD     one mart per page      topic, bill, term, foreign_country, government_entity, client, firm,
                                lobbyist, engagement, each with a *_quarter companion
   |  SQL warehouse + Unity Catalog, one read-only identity per host
   v
APP      app/config/queries/*.sql  ->  /api/analytics/query/<name>  ->  React pages
         Vercel container (public)  and  Databricks Apps (workspace)
```

Hard rules stop at Silver and soft rules start at Gold. Every Silver insert is guarded by a hash key or a `hash_diff`, so rerunning the load inserts nothing. The app reads Gold only, through fixed SQL files with typed parameters, as a service principal that cannot see Bronze or Silver.

## Pages

| Page | URL | Centerpiece |
|---|---|---|
| Home | `/` | Total reported income by quarter; topics, terms, countries and entities ranked |
| Topic | `/topic/TAX` | Income by quarter for the issue; top clients and firms; bills; every engagement |
| Bills | `/bills`, `/bill/119/HR1` | Most-lobbied bills with their stage; one bill's lobbying by quarter with milestone markers |
| Trends | `/trends`, `/trend/tariff` | Any phrase as filings and income by quarter; curated terms |
| Foreign | `/foreign`, `/foreign/Japan` | Foreign-linked lobbying by country and quarter |
| Lobbied | `/lobbied`, `/lobbied/:id` | Government entities contacted, by issue and client |
| Client | `/client/63876` | Firms hired, income by quarter, issues, bills, entities contacted, lobbyists |
| Firm | `/firm/682` | Clients by income, income by quarter, issue mix, roster |
| Lobbyist | `/lobbyist/68995` | Clients and firms, quarters active, disclosed former positions and matches |
| Revolving door | `/revolving-door` | Lobbyists who lobby the body they disclosed working for |
| About | `/about` | Source, freshness, definitions, the attribution rule, this diagram |

## Schema objects

| Layer | Object | Role |
|---|---|---|
| Bronze | `bronze.landing` (volume) | Landing zone for the CSVs |
| Bronze | `lda_filings`, `lda_registrants`, `lda_clients`, `lda_lobbyists`, `lda_lobbying_activities`, `lda_government_entities`, `lda_foreign_entities`, `lda_affiliated_organizations` | Lobbying filings as delivered plus two lineage columns |
| Bronze | `congress_bills`, `congress_bill_actions`, `ref_legislators`, `ref_committees` | Bill details and actions from Congress.gov; legislators and committees from the unitedstates project |
| Silver | `hub_registrant`, `hub_client`, `hub_lobbyist`, `hub_issue`, `hub_government_entity`, `hub_foreign_entity`, `hub_bill`, `hub_legislator`, `hub_committee` | One row per business key; `*_hk = md5(upper(trim(bk)))` |
| Silver | `link_engagement` | One registrant working for one client; hash of both keys |
| Silver | `link_engagement_lobbyist`, `link_engagement_issue`, `link_engagement_government_entity`, `link_engagement_foreign_entity`, `link_engagement_affiliated_organization` | What an engagement has touched |
| Silver | `sat_engagement_filing` | One row per quarterly filing, guarded by `hash_diff` |
| Silver | `sat_engagement_issues_text`, `sat_engagement_lobbyist_filing`, `sat_foreign_entity_filing`, `sat_affiliated_organization_filing` | Per-filing detail: issue text, lobbyist and covered position, foreign funding |
| Silver | `sat_client_profile`, `sat_registrant_profile`, `sat_lobbyist_profile`, `sat_bill_detail`, `sat_bill_action`, `sat_legislator_profile`, `sat_committee_profile` | Descriptive attributes, new row only on change |
| Gold | `fact_filing` | Quarterly reports only, latest amendment wins, real quarter-end dates |
| Gold | `engagement`, `engagement_quarter` | One row per engagement; one row per engagement and quarter |
| Gold | `topic`, `topic_quarter`, `topic_client`, `topic_firm`, `topic_bill` | Topic pages |
| Gold | `bill_congress`, `bill_detail`, `bill_milestone`, `bill_quarter`, `bill_engagement`, `engagement_bill`, `filing_bill` | Bill pages, keyed by congress and bill number |
| Gold | `activity_text`, `term`, `term_quarter`, `term_client`, `term_issue` | Keyword trends, curated and live |
| Gold | `foreign_country`, `foreign_country_quarter`, `foreign_country_client` | Foreign-funded lobbying |
| Gold | `government_entity`, `government_entity_quarter`, `government_entity_issue`, `government_entity_client` | Who gets lobbied |
| Gold | `lobbyist`, `lobbyist_engagement`, `lobbyist_position`, `lobbyist_affiliation`, `revolving_door` | Lobbyist pages and the revolving door |
| Gold | `client`, `client_quarter`, `firm`, `firm_quarter`, `search_entity`, `issue_name` | Client and firm pages, search |
| Gold | `engagement_ai_summary` | Optional one-sentence summaries; empty unless `sql/ai_summaries.sql` is run |
| Tests | `sql/tests.sql` | One statement, one row of zeros when healthy: unique keys, link-to-hub references, one version per `hash_diff`, bill pattern, no null income, status and matching rules |
| Grants | `sql/grants.sql` | USE CATALOG, USE SCHEMA and SELECT on Gold for the two app principals, nothing else |

Rules stated once in `sql/lakehouse.sql`: a filing's income counts in full toward every issue code, bill, term and entity it lists, so those totals overlap and are never summed across pages; registrations carry no income; the latest amendment for an engagement and period wins; an engagement is lapsed when its last quarterly report was a termination or it stopped filing before the newest quarter in the data; null income means zero; the congress of a bill is inferred from the filing year (2024 is the 118th, 2025 the 119th).

## Run it

Authenticate the Databricks CLI, then:

```
export DATABRICKS_WAREHOUSE_ID=<serverless warehouse id>
export LDA_API_KEY=<free key from lda.gov>              # raises the API rate limit
export CONGRESS_API_KEY=<free key from api.congress.gov> # for bill enrichment

python3 ingest/pull_lda.py                      # every 2024 and 2025 filing, about 75 minutes, restartable
for f in data/*.csv data/reference/*.csv; do databricks fs cp "$f" dbfs:/Volumes/workspace/bronze/landing/ --overwrite; done
python3 sql/run_sql.py sql/bronze.sql
python3 sql/run_sql.py sql/lakehouse.sql        # safe to run again
python3 ingest/pull_bills.py                    # reads gold.bill_congress, writes data/bills.csv and data/bill_actions.csv
databricks fs cp data/bills.csv dbfs:/Volumes/workspace/bronze/landing/ --overwrite
databricks fs cp data/bill_actions.csv dbfs:/Volumes/workspace/bronze/landing/ --overwrite
python3 sql/run_sql.py sql/bronze.sql && python3 sql/run_sql.py sql/lakehouse.sql
python3 sql/run_sql.py sql/tests.sql            # expect the TOTAL row to show 0 failures
python3 sql/run_sql.py sql/grants.sql

cd app && pnpm install && pnpm run typegen && pnpm run dev   # http://localhost:8000
cd app && databricks apps deploy                               # workspace copy
cd app && vercel deploy --prod                                 # public copy, container image from Dockerfile.vercel
```

The pulled CSVs are not committed; they are a few hundred megabytes and live in the volume. The reference data under `data/reference/` is committed. The public copy needs four project environment variables on Vercel: `DATABRICKS_HOST`, `DATABRICKS_CLIENT_ID`, `DATABRICKS_CLIENT_SECRET` (a service principal with Gold read only) and `DATABRICKS_WAREHOUSE_ID`. The `/api/*` routes are rate-limited at the edge.

## Cost

Databricks Free Edition carries the storage, the serverless warehouse and the workspace copy of the app at no charge. The LDA and Congress.gov APIs and the legislators data are free. The public copy runs as a Vercel container that scales to zero when idle; at ordinary traffic it costs about a dollar a month, covered by the Pro plan's included credit. Nothing in the standard build calls a paid model.

## What I would do next

- Refresh on a schedule: a Lakeflow job that reruns the ingest for the latest quarter and the lakehouse script, which is already idempotent.
- Earlier years: the ingest takes a list of years, and the vault absorbs history without a remodel.
- Campaign-finance data as a second source; the vault already keys clients and people by hash, so a new source is new satellites.
- A network view for a bill: clients, firms and issues around it on one canvas.

Decisions are recorded in [docs/adr](docs/adr) and the layer-by-layer tour with a presentation script is in [docs/walkthrough.md](docs/walkthrough.md).
