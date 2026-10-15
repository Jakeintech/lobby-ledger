# ADR 0003: On-behalf-of-user auth for sensitive queries

Status: accepted

## Context

A Databricks App runs with its own service principal. Any query the app runs as that principal sees whatever the principal was granted, which is the same for every person using the app. In professional services, who can see which matter is often governed by ethical walls, so the database must know who is asking.

## Decision

- Broad, non-sensitive search (`experience_search.sql`) runs as the app service principal. It is cacheable and shared.
- Detail queries that would be governed in a real firm (`engagement_team.obo.sql`) run on behalf of the signed-in user. In AppKit the `.obo.sql` suffix makes the analytics plugin execute that file with the user's token, forwarded by the Apps proxy, instead of the service principal's. The app needs the `sql` user authorization scope.
- Entitlements live in data: `gold.engagement_access(user_email, engagement_hk)`.

## Two ways to enforce it

1. A view filtering on `current_user()` (`gold.experience_search_secure`, implemented here). Simple and portable, but anyone with access to the base view can bypass it.
2. A Unity Catalog row filter: a SQL function attached to a table with `ALTER TABLE ... SET ROW FILTER fn ON (engagement_hk)`. It applies to every query against the table, including ad hoc ones, which is what an ethical wall needs. Row filters attach to tables, not views, so `experience_search` would become a table. Not applied in this repo yet.

## Consequences

- OBO queries cannot share a cache across users, and every user needs grants on the Gold objects the query reads.
- With OBO, audit logs show the real person, not the app.
