# ADR 0003: One read-only identity per host, no on-behalf-of-user queries

Status: accepted. Supersedes the earlier ADR 0003 (on-behalf-of-user auth for sensitive queries).

## Context

Lobby Ledger is a public explorer of public data. Every visitor should see the same thing, and the public copy of the app runs on a host (Vercel) that has no Databricks user identity to forward. The earlier decision ran one query on behalf of the signed-in user so that Unity Catalog grants could differ per person. That only works inside Databricks Apps, it added a second code path for the same query, and it answered a question this product does not ask.

## Decision

- Each deployment runs with exactly one identity, and that identity can only read Gold:
  - Public site (Vercel container): a dedicated service principal, `lobby-public`, with CAN USE on the warehouse, USE CATALOG on `workspace`, and USE SCHEMA plus SELECT on `gold`. It is in no admin group and cannot see Bronze or Silver.
  - Databricks Apps copy: the app's own service principal with the same grants.
- No query file carries the `.obo.sql` suffix and `databricks.yml` requests no user authorization scopes.
- The development principal used to build the lakehouse is never deployed anywhere.
- Every query is a fixed SQL file with typed parameters and a `LIMIT`, and the public host rate-limits `/api/*`.

## Consequences

- One code path per query and identical behaviour on both hosts.
- Row-level security is out of scope; if a future dataset needed it, the Databricks Apps copy could reintroduce on-behalf-of-user queries behind the same query files.
- Grants are the whole security model, so `sql/grants.sql` is part of the build and `sql/tests.sql` includes a denied read of Silver as the public principal.
