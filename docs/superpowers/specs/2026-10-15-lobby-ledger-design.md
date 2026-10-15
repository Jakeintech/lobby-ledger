# Lobby Ledger: design

Date: 2026-10-15. Status: draft for review.

## 1. Purpose

Lobby Ledger is a public explorer of U.S. federal lobbying disclosures. In one line: who lobbies Congress, for whom, on what, and for how much, quarter by quarter.

Primary users are journalists, researchers, students and curious citizens. Success means a first-time visitor lands on a topic, understands the chart within seconds, can follow any name to a client, firm, bill or lobbyist page, and can share that page by URL.

The product is built on the existing lakehouse (Bronze, Data Vault 2.0 Silver, Gold marts) and keeps it as the reason the product can grow. Nothing in the product, the SQL, the docs or the portfolio site describes the data through any other industry's vocabulary. The data is lobbying data and is presented as such.

## 2. What the user can do

Entry point is a topic or a bill. From there every entity is one click away.

| Page | URL | Centerpiece | Also on the page |
|---|---|---|---|
| Home | `/` | Line chart: total reported income by quarter, 2024 Q1 to 2025 Q4 | Issue areas as tiles ranked by income; search box for a bill number or an organization; three sentences on the data and its limits; link to About |
| Topic | `/topic/:code` (e.g. `TAX`) | Bar chart: income by quarter for this issue | Top 10 clients, top 10 firms (horizontal bars); bills most cited; engagement table sorted by income with the AI summary |
| Bill | `/bill/:key` (e.g. `HR1`) | Bar chart: filings mentioning the bill by quarter | Engagements lobbying on it: client, firm, issue codes, first and last quarter, income |
| Client | `/client/:id` | Bar chart: income reported on this client's filings by quarter | Firms hired, issue mix, bills cited, government entities contacted, lobbyists listed, engagement table |
| Firm | `/firm/:id` | Bar chart: income by quarter across all clients | Clients ranked by income, issue mix, roster of lobbyists with quarters active |
| Lobbyist | `/lobbyist/:id` | Timeline: quarters active per client | Clients and firms they appear with; disclosed covered positions (former government roles), verbatim from the filing |
| About the data | `/about` | None | Source and refresh date; definitions (reported income, quarter, amendment); AI-summary disclaimer; a diagram of the lakehouse; link to the repo |

Search behaviour: a string that matches the bill pattern (`H.R. 1`, `S. 1477`, `HJRES 12`) goes to the bill page; otherwise it searches client and firm names and shows matches as a list.

Every chart has a title that states the message ("TAX lobbying income by quarter"), a y-axis in dollars, time on the x-axis, and a note of the unit and period. Loading states use skeletons, empty states say why the page is empty and offer a link back, errors show the message with a retry.

Dropped from the current app: the three-question frame, the step tracker and progress bar, "who worked it", the replay button, the on-behalf-of-user line, the example chips tied to the old sample, and all professional-services wording.

## 3. Data scope and ingest

Slice: every registrant-client pair that reported income of at least $500,000 on any filing in 2024 or 2025, with its complete 2024-2025 filing history. Expected size: 1,838 seed filings for 2025 and 1,504 for 2024 (API counts on 2026-10-15), roughly 500 to 700 engagements, around 4,000 to 6,000 filings.

`ingest/pull_lda.py` changes:

1. Seed: for each year in 2024 and 2025, page through `filings/?filing_year=Y&filing_amount_reported_min=500000&ordering=-income` and collect distinct (registrant id, client id) pairs. The API ignores issue-code filters, so topics are derived from the data rather than requested.
2. History: for each pair, page through `filings/?registrant_id=R&client_id=C&filing_year=Y` for both years. Keep every filing type including registrations, amendments and terminations.
3. Rate limits: keep the one-second sleep and the 429 backoff. The API caps pages at 25 rows (confirmed; larger `page_size` values are ignored), so the seed is about 135 pages and the history about 1,200 requests. Expected wall time is 30 to 45 minutes; the script is restartable because raw JSON is cached per filing uuid.
4. Flatten to source-shaped CSVs: `filings`, `registrants`, `clients`, `lobbyists` (one row per filing, issue and lobbyist, with `covered_position`), `lobbying_activities` (one row per filing and issue, with the free text), and new `government_entities` (one row per filing, issue and entity name).

CSVs stay in `data/`. Raw JSON stays local. Column names stay as the API delivers them.

## 4. Lakehouse changes

Bronze: `bronze.lda_government_entities` added, same `load_date` and `record_source` columns. Existing five tables are rebuilt from the larger CSVs by the same `read_files` statements.

Silver (hard rules only, all inserts guarded by `WHERE NOT EXISTS`):

- New `hub_government_entity` (`entity_hk = md5(upper(trim(name)))`).
- New `link_engagement_government_entity` (engagement, entity, issue code).
- Existing hubs, links and satellites are unchanged in shape and receive the new rows. `sat_engagement_filing` keeps `hash_diff`; a rerun inserts nothing.

Gold (soft rules), one mart per page, all `CREATE OR REPLACE`:

| Object | Grain | Columns |
|---|---|---|
| `fact_filing` | one quarterly report per engagement and period, latest amendment wins | unchanged |
| `engagement_quarter` | engagement, quarter end | income, filing type, is_termination, lobbyist_count, issue_codes, bill_keys |
| `topic_quarter` | issue code, quarter end | income (sum over engagements that list the issue), engagement_count, client_count, firm_count |
| `topic` | issue code | display name, total income, engagement count, rank |
| `bill` | bill key | label, engagement_count, filings_mentioning, first and last period, issue codes |
| `engagement_bill` | engagement, bill key | unchanged |
| `client` | client id | name, description, state, firms hired (array), total income, quarters active, issue codes, lobbyist_count |
| `firm` | registrant id | name, description, city, state, client_count, total income, issue codes, lobbyist_count |
| `lobbyist` | lobbyist id | full name, covered positions (array of distinct text), client_count, firm_count, quarters active |
| `lobbyist_engagement` | lobbyist, engagement | client, firm, first and last period, quarters listed |
| `engagement` | engagement | client, firm, issue codes, bill labels, total income, first and last period, status, ai_summary, government entities (array) |
| `engagement_ai_summary` | engagement | unchanged; only new engagements are sent to the model |

Removed: `experience_search`, `experience_search_secure`, `engagement_access`, `pit_engagement`, `bridge_registrant_client_lobbyist`, `sat_engagement_computed` (its logic moves into `engagement`). `sql/grants.sql` grants `lobby-public` and the Databricks Apps principal USE and SELECT on `gold` only.

Income attribution rule, stated once in SQL and in About: a filing's income counts in full toward each issue code it lists. Topic totals therefore overlap and are not summed across topics on any page.

Tests (`sql/tests.sql`): existing assertions plus unique keys on every new mart, every `topic_quarter` row has a matching `topic` row, every `bill` key matches the bill pattern, and `engagement` covers every `link_engagement` row.

## 5. Application

AppKit app in `app/`, React with `react-router` (already a dependency), one route per page, one SQL file per query in `config/queries/`:

| Query | Parameters | Page |
|---|---|---|
| `home_quarters` | none | Home chart |
| `home_topics` | none | Home tiles |
| `search_entities` | `q` | Home search |
| `topic_detail`, `topic_quarters`, `topic_clients`, `topic_firms`, `topic_bills`, `topic_engagements` | `code` | Topic |
| `bill_detail`, `bill_quarters`, `bill_engagements` | `key` | Bill |
| `client_detail`, `client_quarters`, `client_engagements`, `client_lobbyists` | `id` | Client |
| `firm_detail`, `firm_quarters`, `firm_clients`, `firm_lobbyists` | `id` | Firm |
| `lobbyist_detail`, `lobbyist_engagements` | `id` | Lobbyist |

All queries run as the host's single identity. No `.obo.sql` files. Results are capped with `LIMIT` (200 rows for tables, 8 for quarters, 10 for top lists). Types come from `appkit generate-types --wait`.

Structure: `client/src/pages/<Page>.tsx` per route, `client/src/components/` for the chart wrapper, entity link, stat tiles, ranked bar list, engagement table, page states. No file over 300 lines. `App.tsx` holds only the router and layout (header with name, search, About link; footer with source and freshness).

Charts: AppKit `BarChart` and `LineChart` with `queryKey` where the shape fits, otherwise `useAnalyticsQuery` plus the chart with `data`. Colors from the AppKit palette tokens. Reduced motion respected.

Smoke test: `tests/smoke.spec.ts` (Playwright) loads Home, follows the top topic tile, follows the first client link, and asserts a chart and a table render. Run locally against the dev server.

## 6. Hosting, identity, cost

- Public: Vercel container (`app/Dockerfile.vercel`, `app/vercel.json` services block) at `lobbying.jakeawilliams.com`, identity `lobby-public` (warehouse CAN_USE, USE CATALOG, USE SCHEMA gold, SELECT gold). Vercel firewall rate limit on `/api/*` of 60 requests per minute per IP.
- Internal: Databricks Apps deployment of the same code, identity is the app's own principal with the same grants. No user authorization scopes.
- The admin principal used for development is never deployed. Its secret is rotated by the owner after this work.
- Cost: Databricks Free Edition $0; Vercel Pro already paid, container scales to zero, cents per month at expected traffic; registry storage about $0.10 per GB for the 0.8 GB image.

## 7. Repository and documentation

- GitHub repo renamed `lobby-ledger`; old URL redirects. App name in `databricks.yml` and Vercel project stay as they are (renaming a Databricks app recreates it).
- README: what the product is, screenshots, the data slice, the architecture diagram, how to run, what is next.
- `docs/walkthrough.md`: layer-by-layer tour and a presentation script, rewritten for the product.
- ADRs: 0001 Data Vault for engagements (context rewritten), 0002 apps read Gold only (object list updated), 0003 replaced by "single identity per host; no on-behalf-of-user", with the old decision recorded as superseded.
- Portfolio site: the work article, home card, résumé entry, profile API and contact link describe Lobby Ledger as a public lobbying explorer on a Databricks lakehouse.
- Commit messages stay plain present tense. No attribution lines, no emoji.

## 8. Acceptance

1. `python3 ingest/pull_lda.py` completes and `data/filings.csv` has at least 3,000 rows covering at least 400 engagements.
2. `sql/bronze.sql`, `sql/lakehouse.sql` run clean twice; `sql/tests.sql` returns all zeros; `sql/proof.sql` shows identical counts across the two runs.
3. Every page in section 2 renders with real data for at least one example entity, with a chart and a table, on desktop and at phone width.
4. The public site serves every page as `lobby-public`; a request for a Silver table from that identity is denied.
5. No file in the repo or the site contains the removed vocabulary (checked by grep for the terms listed in section 2).
6. README, walkthrough and ADRs describe the product as built.

## 9. Out of scope

Historical years before 2024, foreign-entity and affiliated-organization data, user accounts, saved searches, alerts, exports, and any writeback.
