# Walkthrough

A tour of the project: the problem, the architecture, each layer and the decisions behind it.

## The problem

Professional-services firms keep asking the same question: "have we done this before, who did it, and what did we deliver?" The answer is spread across billing, matter management and people systems, and every matter changes over time. U.S. lobbying disclosures have the same shape and are public, so they make an honest twin:

| Professional-services concept | Lobbying disclosure |
|---|---|
| Firm | Registrant |
| Client | Client |
| Timekeeper | Lobbyist |
| Practice group | General issue code (TEC, FIN, HCR, TAX) |
| Matter | Registrant and client engagement |
| Matter history | One filing per quarter: income, team, issues, termination |

## Architecture

```
LDA API (lda.gov)
   |  ingest/pull_lda.py  (stands in for CDC)
   v
BRONZE  workspace.bronze.lda_*        source-shaped, + load_date, record_source
   |  sql/lakehouse.sql  HARD RULES: cast, trim, upper, md5, dedupe
   v
SILVER  Raw Vault: hubs, links, satellites (hash keys, hash_diff)
   |  SOFT RULES: status, totals, amendments, as-of logic
   v
GOLD    Business Vault: pit_engagement, bridge, sat_engagement_computed
        Marts: dim_*, fact_filing, experience_search (+ ai_summary)
   |  SQL warehouse, Unity Catalog grants
   v
APPKIT APP  config/queries/*.sql  ->  /api/analytics/query/<name>  ->  React UI
```

## Request flow in the app

```
Browser (React, @databricks/appkit-ui)
  -> POST /api/analytics/query/experience_search  { parameters }
     -> Databricks Apps proxy (adds the signed-in user's identity headers)
        -> Node server: createApp({ plugins: [server(), analytics()] })
           -> analytics plugin loads config/queries/experience_search.sql
              -> binds named parameters (:issue_code, :keyword, :year)
              -> picks identity: app service principal, or the user for *.obo.sql
                 -> SQL warehouse runs the query against gold.*
                    -> Unity Catalog checks grants for that identity
           <- rows (cached per query + parameters for service-principal queries)
  <- typed result rendered in the table
```

## Layers

### Bronze: source-shaped landing

`ingest/pull_lda.py` samples current engagements for four firms in the TEC, FIN, HCR and TAX issue areas, then pulls every 2024-2025 filing for each engagement by `registrant_id` and `client_id`. It flattens the nested JSON into five CSVs that mirror the source entities: filings, registrants, clients, lobbyists (one row per filing and lobbyist) and lobbying_activities (one row per filing and issue). `sql/bronze.sql` uploads them to a Unity Catalog volume and creates `bronze.lda_*` with two lineage columns, `load_date` and `record_source`. Nothing is renamed or interpreted. In production this is where Qlik Replicate or Lakeflow Connect would land CDC.

### Silver: Raw Vault (hard rules only)

- Hubs: `hub_registrant`, `hub_client`, `hub_lobbyist`, `hub_issue`. One row per business key, with `*_hk = md5(upper(trim(bk)))`.
- Links: `link_engagement` (registrant and client, the matter), `link_engagement_lobbyist`, `link_engagement_issue`.
- Satellites: `sat_engagement_filing` (one row per quarterly filing, guarded by `hash_diff`), `sat_engagement_issues_text`, `sat_engagement_lobbyist_filing` (effectivity: who was listed on which filing), and profile satellites for client, registrant and lobbyist.
- Every insert is `WHERE NOT EXISTS`, so the script is idempotent: rerun it and nothing duplicates.

The proof points: several filings for one registrant and client share one `engagement_hk` and land as several satellite rows; reloading an identical filing produces the same `hash_diff` and inserts nothing.

### Gold: Business Vault and marts (soft rules)

- `fact_filing`: quarterly reports only, latest amendment wins, period label turned into a quarter-end date.
- `pit_engagement`: for every engagement and quarter end, the filing that was current then. As-of questions become a simple equality join.
- `bridge_registrant_client_lobbyist`: pre-walked hub-link-hub paths, one row per engagement, lobbyist and filing.
- `sat_engagement_computed`: status (active or lapsed), total income, quarters active. These are the rules people argue about, so they live here and not in Silver.
- Marts: `dim_registrant`, `dim_client`, `dim_lobbyist`, `fact_filing`, and the wide `experience_search` view with an `ai_summary` per engagement from `ai_query()`.
- Access: `engagement_access` (user to engagement) and `experience_search_secure`, which filters on `current_user()`.

### App: AppKit on Gold

Three SQL files in `app/config/queries/`: `experience_search.sql` (service principal, cached), `engagement_team.obo.sql` (runs as the signed-in user) and `engagement_asof.sql` (uses the PIT table). The React page calls them through `useAnalyticsQuery`, with types generated from the SQL.

## Decisions

- [ADR 0001](adr/0001-data-vault-for-engagements.md): source-shaped Bronze, Data Vault for engagements.
- [ADR 0002](adr/0002-apps-read-gold-only.md): apps read Gold only.
- [ADR 0003](adr/0003-on-behalf-of-user-auth.md): on-behalf-of-user auth for governed queries.


## Ten-minute presentation script

**0:00 The question.** "Have we done this before, who did it, and what did we deliver?" Every professional-services firm asks it, and the answer lives in billing, matter and people systems that each change over time. Public lobbying disclosures have the same shape, so I used them as an honest twin: firm, client, timekeeper, practice group, matter, one observation per quarter.

**1:00 The data.** `ingest/pull_lda.py` samples 46 current engagements across four firms and pulls every 2024-2025 filing for each, 245 in all, into five source-shaped CSVs. Nothing is interpreted on the way in.

**2:00 Bronze.** `sql/bronze.sql` lands the CSVs in a Unity Catalog volume and creates `bronze.lda_*` with only two added columns, `load_date` and `record_source`. This is the landing zone a CDC tool would feed.

**3:00 Silver, the Raw Vault.** Open `sql/lakehouse.sql`. Hubs hold one row per business key with an md5 hash key. Links hold relationships: `link_engagement` is the matter. Satellites hold history: `sat_engagement_filing` has one row per quarterly filing, guarded by `hash_diff`. Every insert is `WHERE NOT EXISTS`, so the script is idempotent. Only hard rules live here: cast, trim, upper, hash.

**5:00 The proof.** Run `sql/proof.sql`. Five engagements each have eight satellite rows under one `engagement_hk`. The row count and the distinct `hash_diff` count are both 245, before and after a rerun.

**6:00 Gold, the Business Vault.** `fact_filing` keeps quarterly reports and lets the latest amendment win. `pit_engagement` precomputes which filing was current at every quarter end, so "as of" becomes an equality join. The bridge pre-walks hub-link-hub so the app never touches the vault. `sat_engagement_computed` holds the arguable rules: status, totals. `ai_query()` writes one sentence per engagement, once.

**8:00 The app.** Three SQL files in `app/config/queries`, typed by `pnpm run typegen`, called from React with `useAnalyticsQuery`. Search TAX and "endowment": three university engagements with their teams and summaries. The team query ends in `.obo.sql`, so deployed it runs as the signed-in user and Unity Catalog enforces that person's grants. `experience_search_secure` shows the same idea in SQL with `current_user()`.

**9:30 What is next.** Deploy with user authorization, swap the CSV pull for Lakeflow Connect, show a second load changing a satellite, and move the Gold rules into a tested pipeline.
