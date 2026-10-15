# ADR 0002: Apps read Gold only

Status: accepted

## Context

The Raw Vault is optimized for loading and audit, not for reading. A screen that walks hubs, links and satellites would duplicate business rules (what counts as "active", which amendment wins) in TypeScript, and every app would drift.

## Decision

The AppKit app queries only `gold.*` objects, one mart per page: `topic`, `topic_quarter`, `bill`, `client`, `firm`, `lobbyist`, `engagement`, `engagement_quarter` and their companions. Business rules (which amendment wins, what counts as income, what lapsed means, how a filing's income is attributed to its issue codes) live in Gold SQL. Silver is granted to the pipeline, not to apps.

## Consequences

- Rules change in one place and every consumer sees the change.
- Gold is a contract; renaming a Gold column is a breaking change for the app's generated types.
- Gold must carry what the app needs, so some denormalization (the wide `experience_search` view) is deliberate.
