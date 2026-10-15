# Lobby Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the lobbying lakehouse into Lobby Ledger, a public explorer of U.S. federal lobbying disclosures with topic, bill, client, firm and lobbyist pages, each centred on a quarterly chart.

**Architecture:** Bronze stays source-shaped CSV-to-Delta. Silver stays a Data Vault 2.0 Raw Vault and gains one hub and one link for government entities. Gold is rebuilt as one mart per page. The AppKit app becomes a react-router app with one SQL file per query and one component file per page; it runs as a single read-only identity per host.

**Tech Stack:** Python 3 + requests (ingest), Databricks SQL on a serverless warehouse (Unity Catalog, Delta, `ai_query`), Databricks AppKit 0.84 (Express + React 19 + Vite + Tailwind v4, `@databricks/appkit-ui` charts), react-router 7, Playwright, Vercel container image, Databricks Apps.

**Spec:** `docs/superpowers/specs/2026-10-15-lobby-ledger-design.md`

## Global Constraints

- No file in the repo, app copy, docs or the portfolio site may contain: "professional-services", "professional services", "timekeeper", "practice group", "matter" (as a noun for an engagement), "ethical wall", "experience search", "have we done this before", "who worked it". Lobbying words only.
- No emoji, no em dashes in any copy or comment. Commit messages plain present tense, no attribution lines.
- No new npm dependencies. `react-router` and `lucide-react` are already installed.
- No `as unknown as` casts. `pnpm run typecheck`, `pnpm run lint`, `pnpm run lint:ast-grep`, `pnpm run build:client` must pass after every app task.
- Every query file in `app/config/queries/` reads `workspace.gold.*` only and ends with a `LIMIT`.
- Every Bash call that touches Databricks starts with `set -a && . /Users/jake/Documents/GitHub/lobbying-experience-search/.env && set +a`.
- No `.obo.sql` files. No user authorization scopes in `app/databricks.yml`.
- Credentials never enter the repo. `.env` and `.env.public` are git-ignored and stay that way.

## Review Focus

1. An issue code with filings but zero income (expenses-only or registration-only engagements): the topic page must still render with a $0 chart, not an empty page. Test in Task 3 (`topic_quarter` includes zero rows) and Task 7 (empty-state copy).
2. A bill key typed with odd spacing or case (`h.r. 1`, `HR1`, `H.R.1`): search must normalize to `HR1` before routing. Test in Task 6 (`normalizeBillKey`).
3. Engagements terminated mid-year: the client and firm charts must show zero for quarters after termination, not carry the last value forward. Test in Task 3 (`engagement_quarter` has no rows after `termination_date`).
4. Income reported as null on a quarterly report (allowed by the LDA): must count as 0, never null, in every mart. Test in Task 3 (`coalesce` assertions in `tests.sql`).
5. Names with ampersands and quotes (`AKIN GUMP STRAUSS HAUER & FELD`): links, search and page titles must round-trip through URL parameters and HTML without breaking. Test in Task 7 (smoke test visits a firm with `&`).

---

### Task 1: Ingest the $500k-seeded slice

**Files:**
- Modify: `ingest/pull_lda.py` (done: seeds by `filing_amount_reported_min`, caches pages, writes `government_entities.csv`)
- Output: `data/filings.csv`, `data/registrants.csv`, `data/clients.csv`, `data/lobbyists.csv`, `data/lobbying_activities.csv`, `data/government_entities.csv`

**Interfaces:**
- Produces: six CSVs with these headers, consumed by `sql/bronze.sql`:
  - `filings`: filing_uuid, registrant_id, client_id, filing_type, filing_type_display, filing_year, filing_period, income, expenses, termination_date, dt_posted, filing_document_url
  - `registrants`: registrant_id, name, description, city, state, country, dt_updated
  - `clients`: client_id, name, general_description, state, country, effective_date
  - `lobbyists`: filing_uuid, general_issue_code, lobbyist_id, first_name, last_name, covered_position, is_new
  - `lobbying_activities`: filing_uuid, general_issue_code, general_issue_code_display, specific_issues
  - `government_entities`: filing_uuid, general_issue_code, entity_id, entity_name

- [ ] **Step 1:** Run `python3 ingest/pull_lda.py` (background, 30 to 45 minutes). Expected: last log line `wrote N rows to data/government_entities.csv` and `exit=0`.
- [ ] **Step 2:** Verify: `wc -l data/*.csv` shows filings >= 3000; `python3 -c "import csv; print(len({(r['registrant_id'],r['client_id']) for r in csv.DictReader(open('data/filings.csv'))}))"` >= 400.
- [ ] **Step 3:** Upload: `for f in data/*.csv; do databricks fs cp "$f" dbfs:/Volumes/workspace/bronze/landing/ --overwrite; done`.
- [ ] **Step 4:** Commit `ingest/pull_lda.py` and `data/*.csv`: `git commit -m "Pull every engagement with a $500k filing in 2024 or 2025"`.

### Task 2: Bronze and Silver additions

**Files:**
- Modify: `sql/bronze.sql` (add `bronze.lda_government_entities`, add it to the count query)
- Modify: `sql/lakehouse.sql` Silver section (add hub and link)

**Interfaces:**
- Produces: `silver.hub_government_entity(entity_hk, entity_bk, load_date, record_source)` with `entity_hk = md5(upper(trim(entity_name)))`; `silver.link_engagement_government_entity(engagement_entity_hk, engagement_hk, entity_hk, issue_code, load_date, record_source)` with `engagement_entity_hk = md5(concat_ws('||', engagement_hk, entity_hk, issue_code))`.

- [ ] **Step 1:** Append to `sql/bronze.sql` after `lda_lobbying_activities`:

```sql
CREATE OR REPLACE TABLE bronze.lda_government_entities AS
SELECT *, current_timestamp() AS load_date, 'lda.senate.gov' AS record_source
FROM read_files('/Volumes/workspace/bronze/landing/government_entities.csv', format => 'csv', header => true, inferSchema => false);
```
and add `UNION ALL SELECT 'government_entities', count(*) FROM bronze.lda_government_entities` to the final count query.

- [ ] **Step 2:** Add to the Silver section of `sql/lakehouse.sql`, after `link_engagement_issue`:

```sql
CREATE TABLE IF NOT EXISTS silver.hub_government_entity (
  entity_hk STRING, entity_bk STRING, load_date TIMESTAMP, record_source STRING);

INSERT INTO silver.hub_government_entity
SELECT DISTINCT md5(upper(trim(entity_name))), upper(trim(entity_name)), current_timestamp(), 'lda.senate.gov'
FROM bronze.lda_government_entities s
WHERE entity_name IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM silver.hub_government_entity h WHERE h.entity_hk = md5(upper(trim(s.entity_name))));

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
```

- [ ] **Step 3:** Run `python3 sql/run_sql.py sql/bronze.sql` then `python3 sql/run_sql.py sql/lakehouse.sql` twice. Expected: every statement SUCCEEDED; hub and link counts identical after the second run.
- [ ] **Step 4:** Commit: `git commit -m "Land government entities in Bronze and the vault"`.

### Task 3: Gold marts, one per page

**Files:**
- Modify: `sql/lakehouse.sql` Gold section (replace everything after `-- GOLD: BUSINESS VAULT`)
- Modify: `sql/tests.sql`, `sql/proof.sql`, `sql/grants.sql`

**Interfaces (every column name is a contract for the queries in Task 5):**

```
gold.fact_filing            unchanged (filing_uuid, engagement_hk, registrant_hk, client_hk, filing_year,
                            filing_period, period_end_date, filing_type, income, expenses, is_termination, dt_posted)
gold.engagement_bill        unchanged (engagement_hk, bill_key, bill_label, filings_mentioning, first_period, last_period, issue_codes)
gold.engagement_ai_summary  unchanged
gold.engagement_quarter     engagement_hk, period_end_date DATE, income DECIMAL(14,2), filing_type, is_termination BOOLEAN,
                            lobbyist_count INT, issue_codes STRING ("EDU, TAX"), bill_labels STRING
gold.engagement             engagement_hk, client_id, client, client_description, registrant_id, firm, issue_codes,
                            bill_labels, government_entities STRING, total_income, first_period, last_period,
                            quarters_active INT, engagement_status ('active'|'lapsed'), ai_summary
gold.topic                  issue_code, issue_name, total_income, engagement_count, client_count, firm_count, rank INT
gold.topic_quarter          issue_code, period_end_date, income, engagement_count, client_count, firm_count
gold.topic_client           issue_code, client_id, client, income, rank
gold.topic_firm             issue_code, registrant_id, firm, income, rank
gold.topic_bill             issue_code, bill_key, bill_label, engagement_count, filings_mentioning
gold.bill                   bill_key, bill_label, engagement_count, filings_mentioning, first_period, last_period, issue_codes
gold.bill_quarter           bill_key, period_end_date, filings_mentioning, engagement_count
gold.client                 client_id, name, description, state, firm_count, firms STRING, total_income,
                            quarters_active, issue_codes, lobbyist_count, engagement_count
gold.client_quarter         client_id, period_end_date, income, engagement_count
gold.firm                   registrant_id, name, description, city, state, client_count, total_income,
                            issue_codes, lobbyist_count, engagement_count
gold.firm_quarter           registrant_id, period_end_date, income, client_count
gold.lobbyist               lobbyist_id, full_name, covered_positions STRING (" | " separated distinct),
                            client_count, firm_count, quarters_active, first_period, last_period
gold.lobbyist_engagement    lobbyist_id, engagement_hk, client_id, client, registrant_id, firm, first_period,
                            last_period, quarters_listed, income_while_listed
gold.search_entity          kind ('client'|'firm'), id, name, total_income
gold.issue_name             issue_code, issue_name (from lda_lobbying_activities.general_issue_code_display)
```

Rules, stated once in SQL comments: a filing's income counts in full toward every issue code it lists, so topic totals overlap; registrations (`RR`, `RA`) carry no income; latest amendment per engagement and period wins; `engagement_status` is `lapsed` when terminated or when the last period is before the newest period in the data; income null means 0.

- [ ] **Step 1:** Replace the Gold section with the marts above. Keep `fact_filing`, `engagement_bill`, `engagement_issue_text`, `engagement_ai_summary`. Remove `pit_engagement`, `bridge_registrant_client_lobbyist`, `sat_engagement_computed`, `experience_search`, `engagement_access`, `experience_search_secure`, `dim_*` (fold into `client`, `firm`, `lobbyist`). Derive `engagement_quarter` from `fact_filing` joined to `silver.sat_engagement_lobbyist_filing` (count distinct lobbyists per filing) and `silver.sat_engagement_issues_text` (issue codes per filing). Topic marts aggregate `engagement_quarter` exploded on `issue_codes`.
- [ ] **Step 2:** Rewrite `sql/tests.sql`: keep the vault assertions; add unique-key checks for every mart; `engagement covers every link_engagement`; `topic_quarter -> topic`; `bill_key RLIKE '^(HR|S|HJRES|SJRES|HCONRES|SCONRES|HRES|SRES)[0-9]{1,5}$'`; `no null income in engagement_quarter`; `no engagement_quarter row after termination_date`.
- [ ] **Step 3:** Rewrite `sql/proof.sql` counts for the new objects. `sql/grants.sql`: both app principals get USE CATALOG, USE SCHEMA gold, SELECT on schema gold; drop the `engagement_access` seed.
- [ ] **Step 4:** Run `sql/lakehouse.sql` twice, then `sql/tests.sql` (all zeros) and `sql/proof.sql`. Run `DROP VIEW/TABLE` for the removed objects once.
- [ ] **Step 5:** Commit: `git commit -m "Rebuild Gold as one mart per page"`.

### Task 4: App shell and router

**Files:**
- Modify: `app/client/src/App.tsx` (router + layout only, under 120 lines)
- Create: `app/client/src/components/Layout.tsx`, `EntityLink.tsx`, `StatTiles.tsx`, `QuarterChart.tsx`, `RankedBars.tsx`, `EngagementTable.tsx`, `PageState.tsx`, `SearchBox.tsx`
- Create: `app/client/src/lib/format.ts` (`money`, `quarterLabel`, `normalizeBillKey`, `billLabel`), `app/client/src/lib/routes.ts`
- Modify: `app/client/src/index.css` (keep tokens; remove step/check animations)
- Delete: everything else under `client/src` from the old page

**Interfaces:**
- `QuarterChart({ title, rows: Array<{ period_end_date: string; value: number }>, unit: 'dollars' | 'count' })` renders a `BarChart` with x = quarter label, y = value.
- `RankedBars({ title, rows: Array<{ id: string; name: string; value: number; href: string }> })`.
- `EngagementTable({ rows: EngagementRow[] })` where `EngagementRow` = the `gold.engagement` columns.
- `PageState({ loading, error, empty, emptyMessage, onRetry, children })`.
- `normalizeBillKey('h.r. 1') === 'HR1'`; `billLabel('HR1') === 'H.R. 1'`.
- Routes: `/`, `/topic/:code`, `/bill/:key`, `/client/:id`, `/firm/:id`, `/lobbyist/:id`, `/about`.

- [ ] Steps: write `format.ts` with the four functions and a `format.test.ts` (vitest, `pnpm test`) covering `normalizeBillKey` on `H.R. 1`, `h.r.1`, `HR 1`, `S. 1477`, `HJRES 12`, and `billLabel` round trips; implement the components with Skeleton/Empty/Alert states; wire the router with placeholder pages; typecheck, lint, build; commit `"Add the Lobby Ledger shell, router and shared components"`.

### Task 5: Queries and types

**Files:**
- Delete: `app/config/queries/*.sql` (old five)
- Create: the 24 query files listed in the spec, section 5, each with `-- @param` headers and a `LIMIT`.

**Interfaces:** result columns equal the mart columns in Task 3; parameter names: `code` STRING, `key` STRING, `id` STRING, `q` STRING.

- [ ] Steps: write each file; run `npx appkit generate-types --wait --no-cache` with `.env` sourced and confirm 24 entries with no `SQL ERR`; commit `"Add one query per page section"`.

### Task 6: Pages

**Files:**
- Create: `app/client/src/pages/HomePage.tsx`, `TopicPage.tsx`, `BillPage.tsx`, `ClientPage.tsx`, `FirmPage.tsx`, `LobbyistPage.tsx`, `AboutPage.tsx`

Each page: a `useAnalyticsQuery` per section with memoized `sql.*` params, `PageState` around each section, a `QuarterChart` centerpiece, `RankedBars` and `EngagementTable` where the spec says, every entity name an `EntityLink`. Home search: `normalizeBillKey` match routes to `/bill/:key`, otherwise `search_entities` list. About: the copy from spec section 2 plus the architecture diagram as preformatted text.

- [ ] Steps: build pages; typecheck, lint, build; run the dev server and screenshot each page with Playwright at 1360 and 390 wide; commit `"Add the topic, bill, client, firm, lobbyist and about pages"`.

### Task 7: Smoke test, review, fix

- [ ] Write `app/tests/smoke.spec.ts` (Playwright): load `/`, expect the home chart and at least one topic tile; click the first tile, expect a chart and the engagement table; click the first client link, expect the client chart; visit a firm whose name contains `&`. Run it against the dev server.
- [ ] Review pass over copy for the banned vocabulary (`grep -rniE 'professional.services|timekeeper|practice group|ethical wall|experience search|who worked it' app/client app/config sql docs README.md`), expected no matches.
- [ ] Commit `"Add the smoke test"`.

### Task 8: Hosting and identity

- [ ] `app/databricks.yml`: remove `user_api_scopes`. Delete `engagement_team.obo.sql` (done in Task 5).
- [ ] Redeploy Databricks Apps: `cd app && databricks apps deploy --auto-approve`; expect RUNNING.
- [ ] Redeploy Vercel: `cd app && vercel deploy --prod --yes --scope jake-williams-1c4aa2cc`; expect Ready; `curl https://lobbying.jakeawilliams.com/health` returns ok; a page query returns rows.
- [ ] Firewall rate limit on `/api/*` (60 per minute per IP) via `vercel firewall` after reading `vercel firewall --help`; spend cap on the project if the CLI exposes it, otherwise note the dashboard step in the README.

### Task 9: Docs, repo name, portfolio site

- [ ] Rewrite `README.md` (product, screenshots in `docs/img/`, data slice, architecture diagram, schema object table from Task 3, run instructions, next steps), `docs/walkthrough.md`, ADR 0001 context, ADR 0002 object list, ADR 0003 superseded by single identity per host. Update `LEARNING.md` locally.
- [ ] Rename the repo: `gh repo rename lobby-ledger` (after `gh auth status` confirms login); `git remote set-url origin https://github.com/Jakeintech/lobby-ledger.git`.
- [ ] Portfolio site: rewrite the six touch points to describe Lobby Ledger; change `SITE.lobbyingRepo`; build, commit, push, `vercel deploy --prod`.
- [ ] Final acceptance pass against spec section 8, then commit and push everything.
