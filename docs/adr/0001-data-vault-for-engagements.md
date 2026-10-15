# ADR 0001: Source-shaped Bronze and a Data Vault for engagements

Status: accepted

## Context

A lobbying engagement (a registrant working for a client) is reported again every quarter. Income, the lobbyists listed, the issues and bills covered, the government entities contacted and the status all change from one filing to the next, and filings get amended. We need full history, we need to reload safely as new quarters post, and we expect more sources later (campaign finance, congressional staff directories) that describe the same organizations and people.

## Decision

- Bronze is source-shaped: one table per source entity, columns exactly as delivered, plus `load_date` and `record_source`. No renames, no business rules. In this repo a Python script stands in for a CDC tool such as Qlik Replicate.
- Silver is a Data Vault 2.0 Raw Vault with hard rules only (cast, trim, upper, md5, dedupe):
  - Hubs hold business keys (registrant, client, lobbyist, issue code).
  - Links hold relationships; `link_engagement` is the engagement itself (one registrant working for one client).
  - Satellites hold descriptive history; `sat_engagement_filing` is one row per quarterly filing, guarded by `hash_diff`.
- Hash keys are `md5(upper(trim(business_key)))`, so any process can compute the key without a lookup, and loads can run in parallel.

## Consequences

- Two filings for the same registrant and client resolve to the same `engagement_hk` and land as two satellite rows. An identical reload is skipped by `hash_diff`.
- A new source joins by adding satellites to existing hubs, not by remodeling.
- More tables and more joins than a dbt type-2 snapshot of a wide table. Gold (bridge, PIT, marts) exists to hide that from consumers.
- Bronze here uses `CREATE OR REPLACE` from files for simplicity. A production pipeline would append with `COPY INTO` or Auto Loader.
