# Walkthrough

The narrative for presenting this repo: the problem, the architecture, each layer, the decisions, and what I learned.

## The problem

Professional-services firms keep asking the same question: "have we done this before, who did it, and what did we deliver?" The answer is spread across billing, matter management and people systems, and every matter changes over time. U.S. lobbying disclosures have the same shape and are public, so they make an honest twin:

| Law firm | Lobbying disclosure |
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
   |  sql/northstar.sql  HARD RULES: cast, trim, upper, md5, dedupe
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

To be filled in as each milestone lands.

## Decisions

- [ADR 0001](adr/0001-data-vault-for-engagements.md): source-shaped Bronze, Data Vault for engagements.
- [ADR 0002](adr/0002-apps-read-gold-only.md): apps read Gold only.
- [ADR 0003](adr/0003-on-behalf-of-user-auth.md): on-behalf-of-user auth for governed queries.

## What I learned

See [LEARNING.md](../LEARNING.md).
