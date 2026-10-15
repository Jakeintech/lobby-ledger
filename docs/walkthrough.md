# Walkthrough

A tour of Lobby Ledger: the question, the data, each layer, and the decisions behind it.

## The question

Who lobbies Congress, for whom, on what, and for how much, and how does that change quarter by quarter? The Senate publishes the answer as tens of thousands of quarterly filings, each one a snapshot of one firm working for one client. The filings are public and free, but they are not browsable: the same engagement appears once a quarter, amendments replace earlier reports, bill numbers hide inside free text, and the lobbyists' former government jobs are a text field nobody indexes. Lobby Ledger turns those filings into pages a journalist or researcher can read in seconds and share by URL.

## The data

| Lobbying concept | Where it comes from |
|---|---|
| Firm (registrant) | `registrant` on each filing |
| Client | `client` on each filing |
| Engagement | one registrant working for one client, observed once per quarter |
| Issue area | `general_issue_code` on each lobbying activity (79 codes, TAX, HCR, ENG ...) |
| Bill | extracted from the activity's free-text description (H.R. 1, S. 1477, H.J.Res. 12) |
| Lobbyist | listed per activity, with a disclosed covered position (former government role) |
| Government entity | the chambers and agencies the activity says were contacted |
| Income | the amount the registrant reported for the quarter, rounded by the filer |

The slice is every engagement with a $500,000 filing in 2024 or 2025 plus its full history for those years. Topics are derived from the data, not chosen.

## Architecture

```
Senate LDA API
   |  ingest/pull_lda.py    seed by income, pull history, cache every page, write six source-shaped CSVs
   v
BRONZE  workspace.bronze.lda_*        as delivered, + load_date, record_source
   |  sql/lakehouse.sql  HARD RULES: cast, trim, upper, md5, WHERE NOT EXISTS
   v
SILVER  Raw Vault: hubs, links, satellites (hash keys, hash_diff, effectivity)
   |  SOFT RULES: amendments, income attribution, status, bill extraction
   v
GOLD    one mart per page: topic*, bill*, client*, firm*, lobbyist*, engagement*, ai summaries
   |  SQL warehouse, Unity Catalog grants, one read-only identity per host
   v
APP     app/config/queries/*.sql  ->  /api/analytics/query/<name>  ->  React pages
```

## Request flow in the app

```
Browser (React, react-router, @databricks/appkit-ui)
  -> POST /api/analytics/query/topic_quarters  { parameters: { code } }
     -> Node server: createApp({ plugins: [server(), analytics()] })
        -> analytics plugin loads config/queries/topic_quarters.sql
           -> binds the typed parameter (:code)
           -> runs it on the SQL warehouse as the host's service principal
              -> Unity Catalog allows Gold only
        <- rows, cached per query and parameters
  <- typed result rendered as the quarterly chart
```

## Layers

### Bronze: source-shaped landing

`ingest/pull_lda.py` seeds from every 2024 and 2025 filing with reported income of $500,000 or more, then pulls the complete history of each registrant-client pair for both years. Every API page is cached on disk, so the pull resumes after a rate limit or a crash. It flattens the nested JSON into six CSVs that mirror the source: filings, registrants, clients, lobbyists (one row per filing, issue and lobbyist), lobbying activities (one row per filing and issue, with the free text) and government entities (one row per filing, issue and entity). `sql/bronze.sql` creates `bronze.lda_*` from the volume with two lineage columns and nothing else.

### Silver: Raw Vault, hard rules only

- Hubs: `hub_registrant`, `hub_client`, `hub_lobbyist`, `hub_issue`, `hub_government_entity`. One row per business key, `*_hk = md5(upper(trim(bk)))`.
- Links: `link_engagement` (registrant and client), `link_engagement_lobbyist`, `link_engagement_issue`, `link_engagement_government_entity`.
- Satellites: `sat_engagement_filing` (one row per quarterly filing, guarded by `hash_diff`), `sat_engagement_issues_text`, `sat_engagement_lobbyist_filing` (who was on which filing, with covered position), and profile satellites for client, registrant and lobbyist.
- Every insert is `WHERE NOT EXISTS`. Run the script twice and the counts do not move. `sql/proof.sql` shows it.

### Gold: one mart per page, soft rules

- `fact_filing` keeps quarterly reports, lets the latest amendment win, and turns the period label into a quarter-end date.
- `engagement_quarter` and `engagement`: the per-quarter series and the one-row summary (totals, status, issue codes, bills, government entities, AI summary) that every page reads.
- Topic marts (`topic`, `topic_quarter`, `topic_client`, `topic_firm`, `topic_bill`) attribute a filing's income in full to each issue code it lists. Topic totals overlap by design and are never summed across topics.
- Bill marts (`bill`, `bill_quarter`, `engagement_bill`) come from a regular expression over the issue text, stated once in SQL so it can be argued with.
- `client`, `firm`, `lobbyist` and their quarter and engagement companions feed the entity pages. The lobbyist mart carries every distinct covered position verbatim.
- `engagement_ai_summary`: one sentence per engagement from `ai_query()`, computed once, labelled as AI-generated wherever it is shown.
- `sql/tests.sql` holds 99 assertions and returns a single row of zeros when the build is healthy.

### App

Seven routes, one SQL file per page section (24 queries), types generated from the SQL, every section wrapped in loading, empty and error states, every chart titled with its message, every name a link. The same code runs as a Vercel container for the public and as a Databricks App inside the workspace, each with its own read-only service principal.

## Decisions

- [ADR 0001](adr/0001-data-vault-for-engagements.md): source-shaped Bronze, Data Vault for engagements.
- [ADR 0002](adr/0002-apps-read-gold-only.md): apps read Gold only.
- [ADR 0003](adr/0003-single-identity-per-host.md): one read-only identity per host, no on-behalf-of-user queries.

## Ten-minute presentation script

**0:00 The question.** Who lobbies Congress, for whom, on what, for how much, and how does it change? The Senate publishes the answer as quarterly filings. Public, free, and unreadable at scale.

**1:00 The data.** `ingest/pull_lda.py` seeds from every $500k filing in 2024 and 2025 and pulls the full history of each engagement. Six source-shaped CSVs, nothing interpreted on the way in. Open one filing JSON to show the shape: registrant, client, activities, lobbyists with covered positions, government entities.

**2:00 Bronze.** `sql/bronze.sql`: the volume, `read_files`, two lineage columns. This is the landing zone a CDC tool would feed.

**3:00 Silver.** Open `sql/lakehouse.sql`. Hubs with md5 hash keys, links for relationships, satellites for history with `hash_diff`. Every insert is `WHERE NOT EXISTS`. Hard rules only. Point at `hub_government_entity` as the example of adding a source entity without touching anything that exists.

**5:00 The proof.** Run `sql/proof.sql` twice. Same counts. Run `sql/tests.sql`: one row of zeros from 99 assertions.

**6:00 Gold.** One mart per page. Show the five rules in the header comment: income to every issue code listed, registrations carry no income, latest amendment wins, what lapsed means, null is zero. Show the bill regex. Show `ai_query` writing one sentence per engagement, once.

**8:00 The product.** Open the site. Home: income by quarter, topics by income. Click TAX: the chart, top clients and firms, bills, every engagement. Click a client: who they hire and what they spend by quarter. Click a lobbyist: their disclosed former government positions. Every page is a URL.

**9:30 What is next.** A scheduled refresh for each new quarter, a wider slice under an API key, and linking covered positions to members and committees.
